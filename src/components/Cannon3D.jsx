import { useEffect, useRef, useState } from 'react';

/** Colours of each side, matching the 2D castles: sandstone with red roofs, or slate grey with blue roofs. */
const SIDE_LOOK = [
  { brick: '#c4a06c', brick2: '#b28d5c', mortar: '#684e34', roof: 0x96402f, flag: 0xc8553d },
  { brick: '#94a0b0', brick2: '#808d9f', mortar: '#444e60', roof: 0x465678, flag: 0x3f7cc0 },
];

/** Procedural brick texture, so the walls look like the masonry of the 2D castles. */
function brickTexture(THREE, look, repeatX, repeatY) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = look.mortar;
  g.fillRect(0, 0, 128, 64);
  for (let row = 0; row < 4; row++) {
    const off = row % 2 ? 16 : 0;
    for (let x = -32; x < 128; x += 32) {
      g.fillStyle = (row + x / 32) % 2 ? look.brick : look.brick2;
      g.fillRect(x + off + 1, row * 16 + 1, 30, 14);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.magFilter = THREE.NearestFilter;
  return t;
}

const CARRIAGE_LENGTH = 2.1;
const CARRIAGE_HEIGHT = 1.14;
const BARREL_LENGTH = 2.75;

/** Loads a GLB, drops its emissive glow, scales its x length to `length` and centres it. */
function loadModel(THREE, loader, url, length, keep) {
  return loader.loadAsync(url).then((gltf) => {
    const model = gltf.scene;
    model.traverse((o) => {
      if (!o.isMesh) return;
      keep(o.geometry);
      for (const m of [].concat(o.material)) {
        m.emissiveMap = null;
        m.emissive?.setRGB(0, 0, 0);
        // without an environment map, strongly metallic PBR materials render almost black
        if ('metalness' in m) m.metalness = Math.min(m.metalness, 0.35);
        m.metalnessMap = null;
        keep(m);
        for (const k of ['map', 'normalMap', 'roughnessMap']) if (m[k]) keep(m[k]);
      }
    });
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const s = length / size.x;
    model.scale.setScalar(s);
    const c = box.getCenter(new THREE.Vector3());
    model.position.set(-c.x * s, -box.min.y * s, -c.z * s);
    const holder = new THREE.Group();
    holder.add(model);
    holder.rotation.y = Math.PI; // muzzle from -x to +x
    return { holder, height: size.y * s };
  });
}

/** Barrel and carriage of the pirate cannon, or null if they cannot be loaded (the primitives stay). */
function loadPirateCannon(THREE, keep) {
  return import('three/examples/jsm/loaders/GLTFLoader.js')
    .then(({ GLTFLoader }) => {
      const loader = new GLTFLoader();
      const base = import.meta.env.BASE_URL;
      return Promise.all([
        loadModel(THREE, loader, `${base}models/pirat-lafette.glb`, CARRIAGE_LENGTH, keep),
        loadModel(THREE, loader, `${base}models/pirat-rohr.glb`, BARREL_LENGTH, keep),
      ]);
    })
    .then(([carriage, barrel]) => {
      // the barrel turns about its trunnions, which sit roughly at its middle
      barrel.holder.position.y = -barrel.height / 2;
      const wrap = new THREE.Group();
      wrap.add(barrel.holder);
      return { carriage: carriage.holder, barrel: wrap };
    })
    .catch(() => null);
}

/**
 * A 3D field gun built from simple three.js primitives, standing on the wall walk of its castle:
 * stone floor, crenellated parapets, a tower with a pointed roof and the mountain in the distance.
 * The barrel follows the chosen angle; the powder keg grows with the charge.
 * three.js is loaded only when this mounts.
 */
export default function Cannon3D({ angle, powder, heat = 0, side, onUnavailable }) {
  const ref = useRef(null);
  const state = useRef({ angle, powder, heat });
  const [ready, setReady] = useState(false);
  state.current = { angle, powder, heat };

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    import('three')
      .then((THREE) => {
        if (disposed) return;
        const canvas = ref.current;
        let renderer;
        try {
          renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        } catch {
          onUnavailable?.();
          return;
        }
        const w = canvas.clientWidth || 260, h = canvas.clientHeight || 162;
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        renderer.setSize(w, h, false);

        const look = SIDE_LOOK[side] || SIDE_LOOK[0];
        const dir = side === 0 ? 1 : -1; // the enemy lies in +x for the left castle, -x for the right one
        const owned = [];
        const keep = (o) => { owned.push(o); return o; };

        const scene = new THREE.Scene();
        scene.fog = new THREE.Fog(0x8e6a86, 14, 40);
        const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100);
        camera.position.set(-0.6 * dir, 2.5, 7.6);
        camera.lookAt(0.2 * dir, 1.1, 0);

        scene.add(new THREE.HemisphereLight(0xffe8d0, 0x40304a, 1.3));
        const sun = new THREE.DirectionalLight(0xfff0dc, 2.2);
        sun.position.set(4 * dir, 7, 5);
        scene.add(sun);

        const bronze = keep(new THREE.MeshStandardMaterial({ color: 0xb08a3c, metalness: 0.45, roughness: 0.38 }));
        const iron = keep(new THREE.MeshStandardMaterial({ color: 0x2e3036, metalness: 0.7, roughness: 0.5 }));
        const wood = keep(new THREE.MeshStandardMaterial({ color: 0x7a4b2a, roughness: 0.85 }));
        const kegWood = keep(new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.8 }));
        const roofMat = keep(new THREE.MeshStandardMaterial({ color: look.roof, roughness: 0.7 }));
        const flagMat = keep(new THREE.MeshStandardMaterial({ color: look.flag, roughness: 0.6, side: THREE.DoubleSide }));
        const mountainMat = keep(new THREE.MeshStandardMaterial({ color: 0x4a3830, roughness: 1, flatShading: true }));
        const stone = (rx, ry) => keep(new THREE.MeshStandardMaterial({ map: keep(brickTexture(THREE, look, rx, ry)), roughness: 0.95 }));
        const geo = (g) => keep(g);
        const box = (wx, hy, dz, mat, x, y, z) => {
          const m = new THREE.Mesh(geo(new THREE.BoxGeometry(wx, hy, dz)), mat);
          m.position.set(x, y, z);
          scene.add(m);
          return m;
        };

        // Wall walk: the stone ledge the gun stands on.
        box(11, 0.5, 4.6, stone(5, 2), 0, -0.25, -0.2);
        box(11, 2.5, 0.6, stone(5, 1.2), 0, -1.75, 2.1);

        // Crenellated parapet along the back.
        const merlonMat = stone(0.6, 0.6);
        box(11, 0.7, 0.45, stone(5, 0.4), 0, 0.35, -2.3);
        for (let x = -5; x <= 5; x += 1.25) box(0.7, 0.6, 0.45, merlonMat, x, 1.0, -2.3);

        // Breastwork towards the enemy, with an embrasure for the barrel.
        const bx = 3.4 * dir;
        box(0.45, 0.7, 4.2, stone(2, 0.4), bx, 0.35, -0.2);
        for (const z of [-1.9, -1.1, 0.9, 1.7]) box(0.45, 0.6, 0.55, merlonMat, bx, 1.0, z);

        // Tower with a pointed roof and a flag behind the gun.
        const tx = -3.6 * dir;
        const tower = new THREE.Mesh(geo(new THREE.CylinderGeometry(1.05, 1.15, 4.6, 20)), stone(3, 2.4));
        tower.position.set(tx, 2.0, -3.3);
        scene.add(tower);
        const roof = new THREE.Mesh(geo(new THREE.ConeGeometry(1.35, 1.8, 20)), roofMat);
        roof.position.set(tx, 5.2, -3.3);
        scene.add(roof);
        const pole = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6)), iron);
        pole.position.set(tx, 6.6, -3.3);
        scene.add(pole);
        const flag = new THREE.Mesh(geo(new THREE.PlaneGeometry(0.7, 0.42)), flagMat);
        flag.position.set(tx + 0.35 * dir, 6.9, -3.3);
        scene.add(flag);

        // The mountain between the castles, far away.
        const mountain = new THREE.Mesh(geo(new THREE.ConeGeometry(9, 9, 7)), mountainMat);
        mountain.position.set(10 * dir, 1.5, -24);
        mountain.rotation.y = 0.4;
        scene.add(mountain);

        // ---------- the gun ----------
        const gun = new THREE.Group();
        scene.add(gun);
        // Simple primitives first; replaced by the pirate cannon models once they have loaded.
        const simple = new THREE.Group();
        gun.add(simple);
        for (const z of [-0.42, 0.42]) {
          const cheek = new THREE.Mesh(geo(new THREE.BoxGeometry(1.9, 0.35, 0.14)), wood);
          cheek.position.set(-0.35, 0.72, z);
          cheek.rotation.z = 0.28;
          simple.add(cheek);
        }
        const trail = new THREE.Mesh(geo(new THREE.BoxGeometry(1.6, 0.18, 0.7)), wood);
        trail.position.set(-1.25, 0.32, 0);
        trail.rotation.z = 0.33;
        simple.add(trail);
        for (const z of [-0.62, 0.62]) {
          const wheel = new THREE.Group();
          wheel.position.set(0.2, 0.62, z);
          wheel.add(new THREE.Mesh(geo(new THREE.TorusGeometry(0.6, 0.06, 10, 32)), iron));
          const hub = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.12, 0.12, 0.18, 16)), wood);
          hub.rotation.x = Math.PI / 2;
          wheel.add(hub);
          for (let k = 0; k < 8; k++) {
            const spoke = new THREE.Mesh(geo(new THREE.BoxGeometry(0.05, 1.1, 0.05)), wood);
            spoke.rotation.z = (k * Math.PI) / 8;
            wheel.add(spoke);
          }
          simple.add(wheel);
        }
        const pivot = new THREE.Group();
        pivot.position.set(0.15, 1.0, 0);
        gun.add(pivot);
        const simpleBarrel = new THREE.Group();
        pivot.add(simpleBarrel);
        const barrel = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.16, 0.24, 2.2, 28)), bronze);
        barrel.rotation.z = -Math.PI / 2;
        barrel.position.x = 0.55;
        simpleBarrel.add(barrel);
        const muzzle = new THREE.Mesh(geo(new THREE.TorusGeometry(0.18, 0.05, 10, 24)), bronze);
        muzzle.rotation.y = Math.PI / 2;
        muzzle.position.x = 1.65;
        simpleBarrel.add(muzzle);
        const bore = new THREE.Mesh(geo(new THREE.CircleGeometry(0.1, 20)), iron);
        bore.rotation.y = Math.PI / 2;
        bore.position.x = 1.67;
        simpleBarrel.add(bore);
        const breech = new THREE.Mesh(geo(new THREE.SphereGeometry(0.25, 20, 14)), bronze);
        breech.position.x = -0.55;
        simpleBarrel.add(breech);
        const knob = new THREE.Mesh(geo(new THREE.SphereGeometry(0.09, 12, 8)), bronze);
        knob.position.x = -0.85;
        simpleBarrel.add(knob);
        const trunnion = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.08, 0.08, 0.9, 12)), bronze);
        trunnion.rotation.x = Math.PI / 2;
        simpleBarrel.add(trunnion);
        gun.rotation.y = side === 0 ? -0.3 : Math.PI + 0.3;

        // Overheating: the barrel glows yellow, orange or pulsing red (barrel materials only).
        const HEAT_GLOW = [null, [0xffc020, 0.35], [0xff6a10, 0.6], [0xff2008, 0.95]];
        const glowMats = [bronze];

        // Pirate cannon (cast-iron barrel on a wooden truck carriage), made with Higgsfield / Meshy.
        // The GLBs lie along x with the muzzle at -x; they are turned so the muzzle points at +x.
        loadPirateCannon(THREE, keep).then((parts) => {
          if (disposed || !parts) return;
          const { carriage, barrel: ironBarrel } = parts;
          simple.visible = false;
          simpleBarrel.visible = false;
          carriage.position.set(-0.15, 0, 0);
          gun.add(carriage);
          ironBarrel.position.set(0.1, 0, 0);
          ironBarrel.traverse((o) => { if (o.isMesh) glowMats.push(...[].concat(o.material)); });
          pivot.add(ironBarrel);
          pivot.position.set(0.05, CARRIAGE_HEIGHT * 0.86, 0);
        });

        // Powder keg next to the gun, scaled by the charge.
        const keg = new THREE.Group();
        keg.position.set(-1.9 * dir, 0, 1.0);
        const body = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.32, 0.32, 0.6, 20)), kegWood);
        body.position.y = 0.3;
        keg.add(body);
        for (const y of [0.1, 0.5]) {
          const hoop = new THREE.Mesh(geo(new THREE.TorusGeometry(0.33, 0.025, 8, 24)), iron);
          hoop.rotation.x = Math.PI / 2;
          hoop.position.y = y;
          keg.add(hoop);
        }
        scene.add(keg);

        let shown = state.current.angle;
        const look0 = new THREE.Vector3(0.2 * dir, 1.1, 0);
        renderer.setAnimationLoop((t) => {
          const { angle: target, powder: pw, heat: ht } = state.current;
          const hg = HEAT_GLOW[Math.min(ht || 0, 3)];
          const pulse = ht >= 3 ? 0.55 + 0.45 * Math.sin(t / 120) : 1;
          for (const m of glowMats) {
            if (!m.emissive) continue;
            if (hg) { m.emissive.setHex(hg[0]); m.emissiveIntensity = hg[1] * pulse; }
            else m.emissiveIntensity = 0;
          }
          shown += (target - shown) * 0.2;
          pivot.rotation.z = (shown * Math.PI) / 180;
          const s = 0.55 + (pw / 20) * 0.75;
          keg.scale.set(s, s, s);
          flag.rotation.y = Math.sin(t / 300) * 0.25;
          camera.position.x = -0.6 * dir + Math.sin(t / 2600) * 0.5;
          camera.lookAt(look0);
          renderer.render(scene, camera);
        });
        setReady(true);

        cleanup = () => {
          renderer.setAnimationLoop(null);
          owned.forEach((o) => o.dispose?.());
          renderer.dispose();
        };
      })
      .catch(() => onUnavailable?.());
    return () => {
      disposed = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side]);

  return (
    <canvas
      ref={ref}
      className={`cannon3d ${ready ? 'ready' : ''}`}
      role="img"
      aria-label={`3D-Geschütz auf dem Wehrgang, Winkel ${angle} Grad, ${powder} Pulver`}
    />
  );
}
