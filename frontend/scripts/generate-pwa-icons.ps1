param(
  [string]$Source = (Join-Path $PSScriptRoot "..\public\logo.png"),
  [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\public\icons")
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$sourceImage = [System.Drawing.Bitmap]::new((Resolve-Path $Source).Path)
$crop = [System.Drawing.Rectangle]::new(55, 415, 294, 205)
$mark = [System.Drawing.Bitmap]::new($crop.Width, $crop.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

for ($y = 0; $y -lt $crop.Height; $y++) {
  for ($x = 0; $x -lt $crop.Width; $x++) {
    $pixel = $sourceImage.GetPixel($crop.X + $x, $crop.Y + $y)
    $luminance = [int](0.2126 * $pixel.R + 0.7152 * $pixel.G + 0.0722 * $pixel.B)
    $alpha = [Math]::Max(0, [Math]::Min(255, (255 - $luminance) * 2))
    $mark.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, 255, 255, 255))
  }
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

function New-LuxuosaIcon {
  param([int]$Size, [double]$MarkWidthRatio, [string]$Filename)

  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $gradient = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    [System.Drawing.Point]::new(0, 0),
    [System.Drawing.Point]::new($Size, $Size),
    [System.Drawing.ColorTranslator]::FromHtml("#7c3aed"),
    [System.Drawing.ColorTranslator]::FromHtml("#1e40af")
  )
  $graphics.FillRectangle($gradient, 0, 0, $Size, $Size)

  $targetWidth = [int]($Size * $MarkWidthRatio)
  $targetHeight = [int]($targetWidth * $mark.Height / $mark.Width)
  $targetX = [int](($Size - $targetWidth) / 2)
  $targetY = [int](($Size - $targetHeight) / 2)
  $graphics.DrawImage($mark, $targetX, $targetY, $targetWidth, $targetHeight)

  $bitmap.Save((Join-Path $OutputDirectory $Filename), [System.Drawing.Imaging.ImageFormat]::Png)
  $gradient.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

New-LuxuosaIcon -Size 192 -MarkWidthRatio 0.68 -Filename "icon-192.png"
New-LuxuosaIcon -Size 512 -MarkWidthRatio 0.68 -Filename "icon-512.png"
New-LuxuosaIcon -Size 512 -MarkWidthRatio 0.56 -Filename "icon-maskable-512.png"
New-LuxuosaIcon -Size 180 -MarkWidthRatio 0.68 -Filename "apple-touch-icon.png"

$mark.Dispose()
$sourceImage.Dispose()
