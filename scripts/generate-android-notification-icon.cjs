// Deterministic Android drawable conversion from the approved transparent mark.
const fs = require("node:fs");
const path = require("node:path");
const { PNG } = require("pngjs");

const dir = path.join(process.cwd(), "assets/images/branding");
const source = PNG.sync.read(fs.readFileSync(path.join(dir, "taswoq-icon-dark.png")));
const output = new PNG({ width: 96, height: 96 });
const scale = Math.max(source.width, source.height) / 96;

for (let y = 0; y < 96; y++) {
  for (let x = 0; x < 96; x++) {
    let coverage = 0;
    for (let sy = 0; sy < 8; sy++) {
      for (let sx = 0; sx < 8; sx++) {
        const px = Math.floor((x + (sx + 0.5) / 8 - 48) * scale + source.width / 2);
        const py = Math.floor((y + (sy + 0.5) / 8 - 48) * scale + source.height / 2);
        if (px < 0 || py < 0 || px >= source.width || py >= source.height) continue;
        const offset = (py * source.width + px) * 4;
        const [red, green, blue, alpha] = source.data.subarray(offset, offset + 4);
        // Engrave the pale mountains and pin as cutouts in the white bag.
        if (alpha >= 128 && !(red > 160 && blue > 155 && green - red < 40)) coverage += 255;
      }
    }
    const target = (y * 96 + x) * 4;
    output.data.fill(255, target, target + 3);
    output.data[target + 3] = Math.round(coverage / 64);
  }
}

fs.writeFileSync(path.join(dir, "taswoq-notification-android.png"), PNG.sync.write(output));
