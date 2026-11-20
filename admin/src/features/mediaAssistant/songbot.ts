import type { BoneSpec, CharacterSpec, PartSpec } from 'wobnimo';

function arm(side: -1 | 1): BoneSpec {
  return { name: side < 0 ? 'armL' : 'armR', parent: 'body', pivot: [side * 0.35, 0.56, 0], drive: { rz: [['flap', side * 0.7]] } };
}

function armParts(side: -1 | 1): PartSpec[] {
  const bone = side < 0 ? 'armL' : 'armR';
  return [
    { bone, shape: 'sphere', radius: 0.075, material: 'joint' },
    { bone, shape: 'capsule', from: [0, -0.02, 0], to: [side * 0.035, -0.24, 0.025], radius: 0.052, material: 'shell' },
    { bone, shape: 'sphere', at: [side * 0.04, -0.27, 0.04], radius: 0.072, material: 'trim' }
  ];
}

/** An upright document assistant with a signal visor and working hands. */
const songbot: CharacterSpec = {
  id: 'songbot', name: 'Songbot',
  tagline: 'A calm document assistant with a signal visor and working hands',
  accent: '#145f9f',
  frame: { target: 0.67, radius: 0.78 },
  bound: { y: 0.69, radius: 0.98 },
  motion: { hop: 0.12, squash: 0.8, snap: 0.95, talkSquash: 0.45 },
  glowPool: 0.12,
  materials: {
    shell: { color: '#1b4f73', f0: 0.07, spec: 0.65, shininess: 75, metal: 0.22, rim: 0.35, gloss: 0.3 },
    trim: { color: '#8baab9', f0: 0.1, spec: 0.85, shininess: 90, metal: 0.45, rim: 0.3, gloss: 0.45 },
    joint: { color: '#1b2e3b', f0: 0.04, spec: 0.3, shininess: 28, rim: 0.25 },
    screen: { color: '#071923', f0: 0.05, spec: 1.1, shininess: 180, rim: 0.1, gloss: 0.8 },
    lamp: { color: '#d4f5f4', f0: 0.05, spec: 0.8, shininess: 70, glows: true, emitStrength: 1.1, gloss: 0.7 }
  },
  bones: [
    { name: 'body', pivot: [0, 0, 0], drive: { ry: [['yaw', 0.18]], rz: [['roll', 0.18]] } },
    { name: 'head', parent: 'body', pivot: [0, 0.7, 0], drive: { rx: [['pitch', -0.75]], ry: [['yaw', 0.65]], rz: [['roll', 0.55]] } },
    arm(-1), arm(1)
  ],
  parts: [
    { bone: 'body', shape: 'roundBox', at: [0, 0.39, 0], half: [0.32, 0.31, 0.23], round: 0.13, material: 'shell' },
    { bone: 'body', shape: 'plate', at: [0, 0.44, 0.224], half: [0.13, 0.085], corner: 0.03, depth: 0.012, material: 'screen' },
    { bone: 'body', shape: 'plate', at: [0, 0.44, 0.24], half: [0.055, 0.018], corner: 0.013, depth: 0.008, material: 'lamp' },
    { bone: 'body', shape: 'cylinder', at: [0, 0.71, 0], radius: 0.084, half: 0.065, round: 0.02, material: 'joint' },
    { bone: 'body', shape: 'roundBox', at: [-0.15, 0.075, 0.08], half: [0.105, 0.065, 0.17], round: 0.055, material: 'trim' },
    { bone: 'body', shape: 'roundBox', at: [0.15, 0.075, 0.08], half: [0.105, 0.065, 0.17], round: 0.055, material: 'trim' },
    { bone: 'head', shape: 'roundBox', at: [0, 0.31, 0], half: [0.43, 0.28, 0.27], round: 0.11, material: 'shell' },
    { bone: 'head', shape: 'plate', at: [0, 0.31, 0.274], half: [0.34, 0.19], corner: 0.075, depth: 0.012, material: 'screen' },
    { bone: 'head', shape: 'cylinder', at: [-0.43, 0.31, 0], rot: [0, 0, 1.5708], radius: 0.095, half: 0.045, round: 0.02, material: 'trim' },
    { bone: 'head', shape: 'cylinder', at: [0.43, 0.31, 0], rot: [0, 0, 1.5708], radius: 0.095, half: 0.045, round: 0.02, material: 'trim' },
    { bone: 'head', shape: 'sphere', at: [-0.465, 0.31, 0.052], radius: 0.036, material: 'lamp' },
    { bone: 'head', shape: 'sphere', at: [0.465, 0.31, 0.052], radius: 0.036, material: 'lamp' },
    ...armParts(-1), ...armParts(1)
  ],
  face: { kind: 'screen', bone: 'head', material: 'screen', center: [0, 0.31], half: [0.33, 0.18], corner: 0.07, cell: 0.032, color: '#b6e7ed' },
  anchors: {
    top: { bone: 'head', at: [0.23, 0.66, 0.06] },
    mouth: { bone: 'head', at: [0, 0.21, 0.3] },
    ear: { bone: 'head', at: [-0.49, 0.31, 0.02] },
    feet: { bone: 'root', at: [0, 0.02, 0.12] }
  },
  acting: {
    idle: {
      head: { rz: [0, 0.12, 1.2, 0] },
      armL: { rz: [-0.16, 0.24, 2.4, 0] },
      armR: { rz: [0.16, 0.24, 2.4, Math.PI] }
    },
    listening: { head: { rz: -0.18 }, armL: { rz: -2.1, rx: -0.35 }, armR: { rx: -0.2 } },
    thinking: { head: { rz: 0.2 }, armR: { rx: -1.1, rz: 0.55 } },
    speaking: {
      armL: { rz: [-0.25, 0.45, 3.2, 0], rx: -0.5 },
      armR: { rz: [0.25, 0.45, 3.2, Math.PI], rx: -0.5 }
    },
    working: { armL: { rx: [-0.75, 0.12, 4, 0] }, armR: { rx: [-0.75, 0.12, 4, Math.PI] } },
    error: { head: { rz: [0, 0.09, 9, 0] }, armL: { rz: -0.45 }, armR: { rz: 0.45 } },
    celebrating: { armL: { rz: -2.2 }, armR: { rz: 2.2 } },
    sleeping: { head: { rx: 0.28 }, armL: { rx: -0.1 }, armR: { rx: -0.1 } },
    sad: { head: { rx: 0.2 }, armL: { rz: 0.12 }, armR: { rz: -0.12 } }
  }
};

export default songbot;
