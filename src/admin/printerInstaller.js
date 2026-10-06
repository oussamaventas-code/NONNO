import installer from '../../tienda/nonno-impresora/instalar.ps1?raw'
import agent from '../../tienda/nonno-impresora/agente.ps1?raw'
import { getLocation } from '../data/locations'

/* ═══════════════════════════════════════════════════════════════
   INSTALADOR DE NONNO IMPRESORA, DESCARGADO DEL PANEL

   Un solo .bat con todo dentro: el local, su código y el programa.
   Al abrirlo, Windows lo lanza con PowerShell, que lee el propio
   archivo desde la marca y ejecuta el instalador de siempre
   (tienda/nonno-impresora/instalar.ps1) saltándose local y código.
   ═══════════════════════════════════════════════════════════════ */

const MARK = '#==NONNO==#'
const BOM = String.fromCharCode(0xfeff)
const BOM_RE = new RegExp(`^${BOM}`)

/* UTF-8 con BOM: Windows PowerShell 5 lee mal las tildes de un .ps1 sin él */
function base64Utf8Bom(text) {
  const bytes = new TextEncoder().encode(`${BOM}${text.replace(BOM_RE, '')}`)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

const psString = (s) => `'${String(s).replace(/'/g, "''")}'`

export function buildInstaller(locationId, key) {
  const head = [
    '@echo off',
    'title Instalar Nonno Impresora',
    /* La marca se parte en dos para que esta línea no se encuentre a sí misma */
    `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding=[Text.Encoding]::UTF8; $t=[IO.File]::ReadAllText('%~f0',[Text.Encoding]::UTF8); iex $t.Substring($t.IndexOf('#=='+'NONNO==#'))"`,
    'exit /b',
  ]
  const body = [
    MARK,
    `$NONNO_SEDE = ${psString(locationId)}`,
    `$NONNO_SEDE_NOMBRE = ${psString(getLocation(locationId)?.name || locationId)}`,
    `$NONNO_KEY = ${psString(key)}`,
    `$NONNO_AGENTE = '${base64Utf8Bom(agent)}'`,
    installer.replace(BOM_RE, ''),
  ]
  return [...head, ...body].join('\r\n').replace(/\r?\n/g, '\r\n')
}

/** Descarga "Instalar-Nonno-Impresora-<local>.bat" (sin tildes ni espacios: la ruta pasa por cmd). */
export function downloadInstaller(locationId, key) {
  const blob = new Blob([buildInstaller(locationId, key)], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Instalar-Nonno-Impresora-${locationId}.bat`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
