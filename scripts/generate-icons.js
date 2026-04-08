const sharp = require('sharp')
const pngToIco = require('png-to-ico')
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ASSETS = path.join(__dirname, '../assets')
const ICONSET = path.join(ASSETS, 'icon.iconset')

// SVG иконка — телефон с камерой, стиль PhoneCam
const svg = `
<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <!-- Фон с закруглёнными углами -->
  <rect width="1024" height="1024" rx="220" fill="#0a0a0a"/>

  <!-- Корпус телефона -->
  <rect x="302" y="172" width="420" height="680" rx="60"
        fill="none" stroke="#e8ff00" stroke-width="38"/>

  <!-- Объектив — внешнее кольцо -->
  <circle cx="512" cy="430" r="118"
        fill="none" stroke="#e8ff00" stroke-width="30"/>

  <!-- Объектив — внутреннее стекло -->
  <circle cx="512" cy="430" r="62" fill="#e8ff00"/>

  <!-- Блик -->
  <circle cx="484" cy="404" r="18" fill="#0a0a0a" opacity="0.35"/>

  <!-- Нижний индикатор (home bar) -->
  <rect x="436" y="782" width="152" height="18" rx="9"
        fill="#e8ff00" opacity="0.4"/>

  <!-- Верхний динамик -->
  <rect x="440" y="210" width="144" height="14" rx="7"
        fill="#e8ff00" opacity="0.25"/>
</svg>
`

async function main() {
  fs.mkdirSync(ASSETS, { recursive: true })
  fs.mkdirSync(ICONSET, { recursive: true })

  console.log('Generating PNG from SVG...')
  const png1024 = await sharp(Buffer.from(svg))
    .resize(1024, 1024)
    .png()
    .toBuffer()

  fs.writeFileSync(path.join(ASSETS, 'icon.png'), png1024)
  console.log('✓ icon.png')

  // Размеры для .iconset (macOS)
  const macSizes = [16, 32, 64, 128, 256, 512, 1024]
  for (const size of macSizes) {
    const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()
    fs.writeFileSync(path.join(ICONSET, `icon_${size}x${size}.png`), buf)
    if (size <= 512) {
      const buf2x = await sharp(Buffer.from(svg)).resize(size * 2, size * 2).png().toBuffer()
      fs.writeFileSync(path.join(ICONSET, `icon_${size}x${size}@2x.png`), buf2x)
    }
  }
  console.log('✓ iconset PNGs')

  // .icns через macOS iconutil
  execSync(`iconutil -c icns "${ICONSET}" -o "${path.join(ASSETS, 'icon.icns')}"`)
  console.log('✓ icon.icns')

  // .ico для Windows — сохраняем 256px PNG и конвертируем через файл
  const ico256Path = path.join(ASSETS, '_ico256.png')
  await sharp(Buffer.from(svg)).resize(256, 256).png().toFile(ico256Path)
  const icoBuffer = await pngToIco.default(ico256Path)
  fs.writeFileSync(path.join(ASSETS, 'icon.ico'), icoBuffer)
  fs.unlinkSync(ico256Path)
  console.log('✓ icon.ico')

  // favicon.png для iPhone страницы
  const favicon = await sharp(Buffer.from(svg)).resize(180, 180).png().toBuffer()
  fs.writeFileSync(path.join(__dirname, '../src/phone/favicon.png'), favicon)
  console.log('✓ favicon.png')

  console.log('\nAll icons generated in assets/')
}

main().catch(console.error)
