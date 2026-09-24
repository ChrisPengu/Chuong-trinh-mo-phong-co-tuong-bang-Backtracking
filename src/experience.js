// Cosmetic profiles only. Rules and AI never depend on presentation settings.
export const CONTACT = 0.78;
export const PIECE_FX = {
  R: { tint: "81,167,222", lift: 5, pitch: 0.82, note: 196, label: "THIẾT XA" },
  C: { tint: "242,142,52", lift: 66, pitch: 0.7, note: 110, label: "PHÁO KÍCH" },
  H: { tint: "169,114,219", lift: 48, pitch: 1.04, note: 294, label: "KỴ KÍCH" },
  E: { tint: "65,171,143", lift: 24, pitch: 0.9, note: 262, label: "NGỌC ẤN" },
  A: { tint: "209,117,151", lift: 18, pitch: 1.13, note: 349, label: "HỘ VỆ" },
  K: { tint: "219,173,62", lift: 12, pitch: 0.86, note: 392, label: "VƯƠNG ẤN" },
  P: { tint: "88,162,151", lift: 10, pitch: 1.2, note: 440, label: "TIẾN BINH" },
};

export function movePose(type, progress, captured = false) {
  const profile = PIECE_FX[type] ?? PIECE_FX.P;
  const p = Math.max(0, Math.min(1, progress));
  const t = Math.max(0, Math.min(1, (p - 0.08) / (CONTACT - 0.08)));
  const travel = t * t * (3 - 2 * t);
  const settle = Math.max(0, (p - CONTACT) / (1 - CONTACT));
  const bounce = Math.sin(settle * Math.PI) * Math.exp(-settle * 3);
  return {
    travel,
    lift: Math.sin(t * Math.PI) * profile.lift * (captured ? 1 : 0.65),
    scaleX: 1 + bounce * 0.2,
    scaleY: 1 - bounce * 0.16,
    charge: Math.sin(Math.min(p / 0.12, 1) * Math.PI / 2),
  };
}

export function drawMoveEnergy(ctx, { sx, sy, tx, ty, x, y, progress, type, captured, strength }) {
  if (strength < 0.5 || progress >= CONTACT) return;
  const profile = PIECE_FX[type] ?? PIECE_FX.P;
  const fade = Math.sin(Math.min(1, progress / CONTACT) * Math.PI);
  const angle = Math.atan2(ty - sy, tx - sx);
  ctx.save();
  ctx.lineCap = "round";
  // Broad colored wake, with a narrow bright core rather than a screen flash.
  const wake = ctx.createLinearGradient(sx, sy, x, y);
  wake.addColorStop(0, `rgba(${profile.tint},0)`);
  wake.addColorStop(0.65, `rgba(${profile.tint},${0.16 * fade * strength})`);
  wake.addColorStop(1, `rgba(${profile.tint},${0.7 * fade})`);
  ctx.strokeStyle = wake;
  ctx.shadowColor = `rgba(${profile.tint},.65)`;
  ctx.shadowBlur = 16;
  ctx.lineWidth = captured ? 15 : 8;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo((sx + x) / 2, (sy + y) / 2 - profile.lift * 0.7, x, y);
  ctx.stroke();
  ctx.shadowBlur = 0;
  if (type === "C" && captured) {
    const glow = ctx.createRadialGradient(x, y, 2, x, y, 43);
    glow.addColorStop(0, "rgba(255,221,151,.7)");
    glow.addColorStop(0.3, `rgba(${profile.tint},.42)`);
    glow.addColorStop(1, `rgba(${profile.tint},0)`);
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(x, y, 43, 0, Math.PI * 2); ctx.fill();
  }
  const count = strength > 1 ? 14 : 8;
  for (let i = 0; i < count; i += 1) {
    const t = Math.max(0, progress - i * 0.022);
    const pose = movePose(type, t, captured);
    const px = sx + (tx - sx) * pose.travel;
    const py = sy + (ty - sy) * pose.travel - pose.lift;
    const spread = Math.sin(i * 2.4) * (type === "R" ? 18 : 12);
    ctx.strokeStyle = `rgba(${profile.tint},${fade * (1 - i / count) * 0.8})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(px + Math.sin(angle) * spread, py - Math.cos(angle) * spread);
    ctx.lineTo(px - Math.cos(angle) * (type === "R" ? 22 : 7) + Math.sin(angle) * spread,
      py - Math.sin(angle) * (type === "R" ? 22 : 7) - Math.cos(angle) * spread);
    ctx.stroke();
  }
  if (type === "H") {
    ctx.strokeStyle = `rgba(${profile.tint},${fade * 0.5})`;
    for (let i = 1; i <= 3; i += 1) {
      ctx.beginPath();
      ctx.ellipse(sx + (x - sx) * i / 4, sy + (ty - sy) * movePose(type, progress, captured).travel * i / 4,
        10 + i * 2, 4, angle, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawImpactSignature(ctx, { x, y, type, progress, strength, capture }) {
  if (strength < 0.5) return;
  const { tint } = PIECE_FX[type] ?? PIECE_FX.P;
  const fade = Math.pow(1 - progress, 2);
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = `rgba(${tint},${fade * 0.85})`;
  ctx.shadowColor = `rgba(${tint},.55)`;
  ctx.shadowBlur = 9;
  ctx.lineWidth = capture ? 2.5 : 1.5;
  const reach = 35 + progress * (capture ? 90 : 30);
  if (type === "R") {
    // Four sweeping blades.
    for (let i = 0; i < 4; i += 1) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath(); ctx.moveTo(25, -8); ctx.quadraticCurveTo(reach, -28, reach + 13, 6); ctx.stroke();
    }
  } else if (type === "C") {
    // Expanding shock rings in perspective.
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath(); ctx.ellipse(0, i * 5, reach + i * 9, (reach + i * 9) * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
    }
  } else {
    const vertices = type === "K" ? 8 : type === "H" ? 3 : type === "E" ? 6 : 4;
    ctx.rotate(progress * 0.8);
    ctx.beginPath();
    for (let i = 0; i <= vertices; i += 1) {
      const angle = i * Math.PI * 2 / vertices;
      const px = Math.cos(angle) * reach;
      const py = Math.sin(angle) * reach;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
}
