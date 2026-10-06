import { useEffect, useRef, useState } from "react";
import { ExternalLink, MonitorDown, MoreVertical, Share, Smartphone, SquarePlus, X } from "lucide-react";
import { Button } from "../components/ui/Button.jsx";
import { usePwaInstall } from "./PwaInstallProvider.jsx";

function Step({ number, icon: Icon, children }) {
  return (
    <li className="ui-step">
      <span className="ui-step-num" aria-hidden>{number}</span>
      <span className="flex min-w-0 items-start gap-2 text-sm leading-6 text-slate-700">
        <Icon className="mt-1 h-4 w-4 shrink-0 text-violet-600" aria-hidden />
        <span>{children}</span>
      </span>
    </li>
  );
}

function ManualSteps({ environment }) {
  if (environment.platform === "ios") {
    const thirdParty = environment.browser !== "safari-ios";
    return (
      <div>
        <p className="mb-3 text-sm font-semibold text-slate-900">
          {thirdParty ? "No navegador do seu iPhone ou iPad" : "No Safari do seu iPhone ou iPad"}
        </p>
        <ol className="space-y-3">
          <Step number="1" icon={Share}>Toque em <strong>Compartilhar</strong>.</Step>
          <Step number="2" icon={SquarePlus}>Escolha <strong>Adicionar à Tela de Início</strong>.</Step>
          <Step number="3" icon={Smartphone}>Confirme em <strong>Adicionar</strong>.</Step>
        </ol>
        {thirdParty ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
            Se essa opção não aparecer no menu Compartilhar, abra esta página no Safari e repita os passos.
          </p>
        ) : null}
      </div>
    );
  }

  if (environment.platform === "android") {
    return (
      <div>
        <p className="mb-3 text-sm font-semibold text-slate-900">No navegador do seu Android</p>
        <ol className="space-y-3">
          <Step number="1" icon={MoreVertical}>Abra o <strong>menu do navegador</strong>.</Step>
          <Step number="2" icon={SquarePlus}>Toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</Step>
          <Step number="3" icon={Smartphone}>Revise os dados e confirme a instalação.</Step>
        </ol>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-slate-900">No computador</p>
      <ol className="space-y-3">
        <Step number="1" icon={MonitorDown}>Procure o ícone de instalação na barra de endereços.</Step>
        <Step number="2" icon={MoreVertical}>Ou abra o menu do navegador e escolha <strong>Instalar Luxuosa</strong>.</Step>
      </ol>
    </div>
  );
}

export function InstallAppDialog() {
  const { canPrompt, dialogOpen, dismissInstall, environment, installed, requestInstall, setDialogOpen } = usePwaInstall();
  const [promptUnavailable, setPromptUnavailable] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!dialogOpen) return undefined;
    setPromptUnavailable(false);
    const previous = document.activeElement;
    const onKeyDown = (event) => {
      if (event.key === "Escape") dismissInstall();
    };
    document.addEventListener("keydown", onKeyDown);
    window.setTimeout(() => panelRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus?.();
    };
  }, [dialogOpen, dismissInstall]);

  if (!dialogOpen || installed) return null;

  const handleInstall = async () => {
    if (!canPrompt) {
      setPromptUnavailable(true);
      return;
    }
    const result = await requestInstall();
    if (result.outcome === "unavailable") setPromptUnavailable(true);
    if (result.outcome === "accepted") setDialogOpen(false);
  };

  return (
    <div className="ui-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && dismissInstall()}>
      <section
        ref={panelRef}
        className="ui-modal-panel max-w-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-app-title"
        aria-describedby="install-app-description"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/icons/icon-192.png" alt="" className="h-16 w-16 shrink-0 rounded-2xl shadow-md ring-1 ring-slate-200" />
            <div className="min-w-0">
              <h2 id="install-app-title" className="text-xl">Instale a Luxuosa</h2>
              <p id="install-app-description" className="mt-1 text-sm leading-5 text-slate-600">
                Acesse o sistema com mais rapidez pela tela inicial do seu dispositivo.
              </p>
            </div>
          </div>
          <button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={dismissInstall} aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="my-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          {canPrompt && !promptUnavailable ? (
            <div className="flex items-start gap-3 text-sm leading-6 text-slate-700">
              <MonitorDown className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" aria-hidden />
              <p className="min-w-0">Seu navegador pode abrir agora a confirmação oficial de instalação.</p>
            </div>
          ) : (
            <ManualSteps environment={environment} />
          )}
        </div>

        {promptUnavailable ? (
          <p className="mb-3 flex items-start gap-2 text-xs leading-5 text-slate-600" role="status">
            <ExternalLink className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            A instalação automática não está disponível agora. Use os passos acima no menu do navegador.
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={dismissInstall}>Agora não</Button>
          <Button onClick={handleInstall}>Instalar aplicativo</Button>
        </div>
      </section>
    </div>
  );
}
