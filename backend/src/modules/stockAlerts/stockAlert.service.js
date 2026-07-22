import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { productService } from "../products/product.service.js";
import { pagedResult } from "../../shared/pagination.js";

const SEVERITY_RANK = { critical: 2, low: 1 };

function severityAtLeast(itemSeverity, minSeverity) {
  const item = SEVERITY_RANK[itemSeverity] || 0;
  const min = SEVERITY_RANK[minSeverity] || SEVERITY_RANK.low;
  return item >= min;
}

function settingsFromTenant(tenant) {
  return {
    enabled: Boolean(tenant.stockAlertsEnabled),
    email: tenant.stockAlertEmail || null,
    phone: tenant.stockAlertPhone || null,
    minSeverity: tenant.stockAlertMinSeverity || "low",
    cooldownMin: Number(tenant.stockAlertCooldownMin || 1440)
  };
}

async function sendEmail({ to, subject, text, productId, severity }) {
  if (!to) {
    return { status: "skipped", message: "Email nao configurado." };
  }

  const smtpConfigured = Boolean(env.smtp?.url || env.smtp?.host);
  if (!smtpConfigured) {
    console.info("[stockAlerts] email (logged)", { to, subject, text });
    return {
      status: "logged",
      message: text,
      productId,
      severity
    };
  }

  try {
    const nodemailer = await import("nodemailer");
    const transporter = env.smtp.url
      ? nodemailer.createTransport(env.smtp.url)
      : nodemailer.createTransport({
          host: env.smtp.host,
          port: env.smtp.port,
          secure: env.smtp.secure,
          auth:
            env.smtp.user && env.smtp.pass
              ? { user: env.smtp.user, pass: env.smtp.pass }
              : undefined
        });

    await transporter.sendMail({
      from: env.smtp.from || env.smtp.user || "luxuosa@localhost",
      to,
      subject,
      text
    });
    return { status: "sent", message: text, productId, severity };
  } catch (error) {
    return {
      status: "error",
      message: text,
      error: String(error?.message || error).slice(0, 2000),
      productId,
      severity
    };
  }
}

async function sendWhatsApp({ phone, text, productId, severity }) {
  if (!phone) {
    return { status: "skipped", message: "Telefone nao configurado." };
  }
  const webhook = env.whatsappWebhookUrl;
  if (!webhook) {
    return { status: "skipped", message: "WHATSAPP_WEBHOOK_URL nao configurado." };
  }

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ phone, message: text, productId, severity })
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        status: "error",
        message: text,
        error: `Webhook ${res.status}: ${body.slice(0, 500)}`,
        productId,
        severity
      };
    }
    return { status: "sent", message: text, productId, severity };
  } catch (error) {
    return {
      status: "error",
      message: text,
      error: String(error?.message || error).slice(0, 2000),
      productId,
      severity
    };
  }
}

export const stockAlertService = {
  async getSettings(tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        stockAlertsEnabled: true,
        stockAlertEmail: true,
        stockAlertPhone: true,
        stockAlertMinSeverity: true,
        stockAlertCooldownMin: true
      }
    });
    if (!tenant) {
      const err = new Error("Loja nao encontrada.");
      err.statusCode = 404;
      throw err;
    }
    return settingsFromTenant(tenant);
  },

  async updateSettings(tenantId, payload) {
    const data = {};
    if (payload.enabled !== undefined) data.stockAlertsEnabled = Boolean(payload.enabled);
    if (payload.email !== undefined) {
      data.stockAlertEmail = payload.email ? String(payload.email).trim() : null;
    }
    if (payload.phone !== undefined) {
      data.stockAlertPhone = payload.phone ? String(payload.phone).trim() : null;
    }
    if (payload.minSeverity !== undefined) {
      const sev = String(payload.minSeverity).toLowerCase();
      if (sev !== "low" && sev !== "critical") {
        const err = new Error("minSeverity deve ser low ou critical.");
        err.statusCode = 400;
        throw err;
      }
      data.stockAlertMinSeverity = sev;
    }
    if (payload.cooldownMin !== undefined) {
      const n = Math.floor(Number(payload.cooldownMin));
      if (!Number.isFinite(n) || n < 0) {
        const err = new Error("cooldownMin invalido.");
        err.statusCode = 400;
        throw err;
      }
      data.stockAlertCooldownMin = n;
    }

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data,
      select: {
        stockAlertsEnabled: true,
        stockAlertEmail: true,
        stockAlertPhone: true,
        stockAlertMinSeverity: true,
        stockAlertCooldownMin: true
      }
    });
    return settingsFromTenant(tenant);
  },

  async listLogs(tenantId, { take = 50, skip = 0 } = {}) {
    const where = { tenantId };
    const [items, total] = await Promise.all([
      prisma.stockAlertLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip
      }),
      prisma.stockAlertLog.count({ where })
    ]);
    return pagedResult(items, { total, take, skip });
  },

  async runCheck(tenantId) {
    const settings = await this.getSettings(tenantId);
    if (!settings.enabled) {
      return { ran: false, reason: "disabled", alerts: [] };
    }

    const lowStock = await productService.lowStock(tenantId);
    const candidates = lowStock.filter((p) =>
      severityAtLeast(p.severity, settings.minSeverity)
    );

    const cooldownMs = Math.max(0, settings.cooldownMin) * 60_000;
    const now = Date.now();
    const alerts = [];

    for (const product of candidates) {
      const last = await prisma.stockAlertLog.findFirst({
        where: {
          tenantId,
          productId: product.id,
          status: { in: ["sent", "logged"] }
        },
        orderBy: { createdAt: "desc" }
      });
      if (last && now - new Date(last.createdAt).getTime() < cooldownMs) {
        alerts.push({
          productId: product.id,
          skipped: true,
          reason: "cooldown"
        });
        continue;
      }

      const text = `[Luxuosa] Estoque ${product.severity}: ${product.name} (${product.currentStock}/${product.minStock})`;

      const emailResult = await sendEmail({
        to: settings.email,
        subject: `Alerta de estoque: ${product.name}`,
        text,
        productId: product.id,
        severity: product.severity
      });
      await prisma.stockAlertLog.create({
        data: {
          tenantId,
          channel: "email",
          productId: product.id,
          severity: product.severity,
          status: emailResult.status,
          message: emailResult.message || null,
          error: emailResult.error || null
        }
      });

      const waResult = await sendWhatsApp({
        phone: settings.phone,
        text,
        productId: product.id,
        severity: product.severity
      });
      await prisma.stockAlertLog.create({
        data: {
          tenantId,
          channel: "whatsapp",
          productId: product.id,
          severity: product.severity,
          status: waResult.status,
          message: waResult.message || null,
          error: waResult.error || null
        }
      });

      alerts.push({
        productId: product.id,
        name: product.name,
        severity: product.severity,
        email: emailResult.status,
        whatsapp: waResult.status
      });
    }

    return {
      ran: true,
      candidateCount: candidates.length,
      alerts
    };
  }
};
