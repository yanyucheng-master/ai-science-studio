/* Textbook-style cutaway teaching models. All geometry is local and uses the existing structure IDs. */
(() => {
  "use strict";
  const libraryUrl = new URL("vendor/three-0.185.1/three.module.min.js", document.currentScript.src).href;
  const DEFAULT_VIEW = Object.freeze({ yaw: -30, pitch: 10, zoom: 1 });
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const wrap = value => ((value + 180) % 360 + 360) % 360 - 180;
  const BOUNDARY_IDS = new Set(["cellWall", "cellMembrane", "cytoplasm", "vacuole"]);

  /*
   * Textbook-style cutaway models (人教版七年级上册 / 必修1《分子与细胞》).
   * The cell keeps its solid outer form and the upper-front quarter is removed, so the
   * horizontal cut ("floor", y = 0, z > 0) and the vertical cut ("wall", z = 0, y > 0)
   * show the layered section, while organelles sit on those cut faces in their textbook
   * 3D forms. All geometry is procedural and uses the existing structure IDs.
   */
  function buildModel(THREE, type, structures, cutaway = "quarter") {
    const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
    const root = new THREE.Group();
    const groups = new Map();
    const anchors = new Map();
    const pendingAnchors = [];
    const materials = new Set();
    const geometries = new Set();
    const available = new Set(structures.map(item => item.id));
    const has = id => available.has(id);
    const senior = has("endoplasmicReticulum");
    const plant = type === "plant";
    const half = cutaway === "half";
    const occupied = { floor: [], wall: [] };
    let seed = plant ? 17 : 41;
    const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    for (const { id } of structures) {
      const group = new THREE.Group();
      group.userData.organelle = id;
      groups.set(id, group);
      root.add(group);
    }

    // Colours follow the 2D textbook diagram palette (pale fills, darker membranes).
    const C = {
      wall: 0xd6e8bf, wallCut: 0xc9dfa8, wallEdge: 0x6f9f5a,
      membrane: 0x2f7ea3, animalSurface: 0xf2dccb,
      cytoplasmPlant: 0xf6f2d6, cytoplasmAnimal: 0xfcefe4,
      vacuole: 0xcfe8f5, tonoplast: 0x5d9fcb,
      nucleus: 0xcdb6ea, nucleusDark: 0x6a4dad, nucleoplasm: 0xebe2f8, nucleolus: 0x5b3f99, chromatin: 0x8466bd,
      chloroplast: 0x8fca84, chloroplastJunior: 0x6dbb78, chloroDark: 0x3c8a50, stroma: 0xd5edca, granum: 0x3f8f4a,
      mito: 0xf6c29a, mitoDark: 0xc4633b, matrix: 0xfde3cc, crista: 0xe38f60,
      er: 0x86acd9, erEdge: 0xb9d0ec, ribosome: 0x5c4c96,
      golgi: 0xdca24c, golgiLight: 0xf0c978,
      lysosome: 0xf0b7c4, lysosomeDark: 0xbd5b76,
      centriole: 0x2f8a8a, centroCloud: 0xbfe2e0
    };

    function material(id, color, options = {}) {
      const { physical = false, ...rest } = options;
      const Surface = physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
      const surface = new Surface({ color, roughness: 0.62, metalness: 0, side: THREE.DoubleSide, ...rest });
      surface.userData.organelle = id;
      materials.add(surface);
      return surface;
    }

    function addMesh(geometry, surface, parent, { cast = true, receive = true } = {}) {
      geometries.add(geometry);
      const object = new THREE.Mesh(geometry, surface);
      object.userData.organelle = surface.userData.organelle;
      object.castShadow = cast;
      object.receiveShadow = receive;
      parent.add(object);
      return object;
    }

    function instanced(geometry, surface, parent, transforms, { cast = true } = {}) {
      if (!transforms.length) return null;
      geometries.add(geometry);
      const object = new THREE.InstancedMesh(geometry, surface, transforms.length);
      transforms.forEach((matrix, index) => object.setMatrixAt(index, matrix));
      object.instanceMatrix.needsUpdate = true;
      object.userData.organelle = surface.userData.organelle;
      object.castShadow = cast;
      object.receiveShadow = true;
      parent.add(object);
      return object;
    }

    const NO_CAST = { cast: false };
    const at = (x, y, z, scale = 1) => new THREE.Matrix4().compose(V3(x, y, z), new THREE.Quaternion(), V3(scale, scale, scale));

    function bufferGeometry(positions, indices) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      return geometry;
    }

    // Make winding (and so vertex normals) agree with `test`; shadow normal bias relies on it.
    function orient(geometry, test) {
      const position = geometry.getAttribute("position"), normal = geometry.getAttribute("normal");
      const p = V3(), n = V3();
      let sum = 0;
      for (let i = 0; i < position.count; i++) sum += test(p.fromBufferAttribute(position, i), n.fromBufferAttribute(normal, i), i);
      if (sum < 0) {
        const index = geometry.index.array;
        for (let i = 0; i < index.length; i += 3) [index[i + 1], index[i + 2]] = [index[i + 2], index[i + 1]];
        geometry.index.needsUpdate = true;
        geometry.computeVertexNormals();
      }
      return geometry;
    }
    const facing = direction => (p, n) => n.dot(direction);
    const away = centre => (p, n) => n.x * (p.x - centre.x) + n.y * (p.y - centre.y) + n.z * (p.z - centre.z);

    function gridSurface(rows, cols, point) {
      const positions = [], indices = [];
      for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) positions.push(...point(r / rows, c / cols));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const a = r * (cols + 1) + c, b = a + 1, d = a + cols + 1, e = d + 1;
          indices.push(a, d, b, b, d, e);
        }
      }
      return bufferGeometry(positions, indices);
    }

    // Planar strip between two outlines with equal point counts.
    function band(outer, inner, map, closed = false, normal = null) {
      const positions = [], indices = [];
      const count = outer.length;
      for (let i = 0; i < count; i++) positions.push(...map(outer[i]), ...map(inner[i]));
      for (let i = 0; i < (closed ? count : count - 1); i++) {
        const j = (i + 1) % count;
        indices.push(2 * i, 2 * i + 1, 2 * j, 2 * j, 2 * i + 1, 2 * j + 1);
      }
      const geometry = bufferGeometry(positions, indices);
      return normal ? orient(geometry, facing(normal)) : geometry;
    }

    function fan(outline, map, center, closed = false, normal = null) {
      const positions = [...map(center)], indices = [];
      for (const point of outline) positions.push(...map(point));
      for (let i = 1; i < outline.length; i++) indices.push(0, i, i + 1);
      if (closed) indices.push(0, outline.length, 1);
      const geometry = bufferGeometry(positions, indices);
      return normal ? orient(geometry, facing(normal)) : geometry;
    }

    function tubeAlong(points, radius, surface, parent, closed = false, radial = 6) {
      const curve = new THREE.CatmullRomCurve3(points.map(point => (point.isVector3 ? point : V3(...point))), closed);
      return addMesh(new THREE.TubeGeometry(curve, Math.max(16, points.length * 2), radius, radial, closed), surface, parent);
    }

    // Open outline of a rectangle with rounded far corners: from (left, 0) round to (right, 0).
    const RECT_SAMPLES = { side: 8, corner: 10, top: 26 };
    function halfRect(left, right, top, radius) {
      const r = Math.max(0.03, Math.min(radius, (right - left) / 2 - 0.01, top - 0.01));
      const { side, corner, top: across } = RECT_SAMPLES;
      const points = [];
      for (let i = 0; i < side; i++) points.push([left, (top - r) * i / side]);
      for (let i = 0; i <= corner; i++) {
        const angle = Math.PI - Math.PI / 2 * i / corner;
        points.push([left + r + r * Math.cos(angle), top - r + r * Math.sin(angle)]);
      }
      for (let i = 1; i < across; i++) points.push([left + r + (right - left - 2 * r) * i / across, top]);
      for (let i = 0; i <= corner; i++) {
        const angle = Math.PI / 2 - Math.PI / 2 * i / corner;
        points.push([right - r + r * Math.cos(angle), top - r + r * Math.sin(angle)]);
      }
      for (let i = side - 1; i >= 0; i--) points.push([right, (top - r) * i / side]);
      return points;
    }

    // Inset an open convex outline whose ends lie on the base line b = 0.
    function inset(points, distance) {
      const top = Math.max(...points.map(point => point[1]));
      const reference = [points.reduce((sum, point) => sum + point[0], 0) / points.length, top * 0.35];
      return points.map((point, i) => {
        const prev = points[Math.max(0, i - 1)], next = points[Math.min(points.length - 1, i + 1)];
        let nx = -(next[1] - prev[1]), ny = next[0] - prev[0];
        const length = Math.hypot(nx, ny) || 1;
        nx /= length; ny /= length;
        if (nx * (reference[0] - point[0]) + ny * (reference[1] - point[1]) < 0) { nx = -nx; ny = -ny; }
        const result = [point[0] + nx * distance, point[1] + ny * distance];
        if (i === 0 || i === points.length - 1) result[1] = 0;
        return result;
      });
    }

    const FACE = {
      floor: { map: ([a, b], lift = 0) => [a, lift, b], normal: V3(0, 1, 0) },
      wall: { map: ([a, b], lift = 0) => [a, b, lift], normal: V3(0, 0, 1) }
    };

    // An organelle frame whose local +y is the outward normal of a cut face.
    function place(id, face, a, b, angle = 0, lift = 0, footprint = 0.25) {
      const group = new THREE.Group();
      if (face === "floor") { group.position.set(a, lift, b); group.rotation.set(0, angle, 0); }
      else { group.position.set(a, b, lift); group.rotation.set(Math.PI / 2, angle, 0); }
      groups.get(id).add(group);
      if (footprint) occupied[face].push({ a, b, r: footprint });
      return group;
    }

    function anchor(id, object, point) { if (has(id)) pendingAnchors.push([id, object, V3(...point)]); }

    /* ---------- Organelle forms ---------- */

    // Surface of revolution about local x; the lower half (y <= 0) when `half` is set.
    const profileRadius = (radius, q) => t => radius * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(t), q)), 1 / q);
    function lathe(length, radius, q, sy, sz, { half = false, inward = false, rows = 30, cols = 24 } = {}) {
      const rho = profileRadius(radius, q);
      const sign = inward ? -1 : 1;
      return orient(gridSurface(rows, cols, (r, c) => {
        const t = Math.sin(Math.PI * (r - 0.5));
        const alpha = half ? Math.PI / 2 + Math.PI * c : Math.PI * 2 * c;
        return [length * t, rho(t) * Math.cos(alpha) * sy, rho(t) * Math.sin(alpha) * sz];
      }), (p, n) => sign * (n.y * p.y + n.z * p.z));
    }
    function latheLoop(length, radius, q, sz, count = 32) {
      const rho = profileRadius(radius, q);
      const side = [];
      for (let i = 0; i <= count; i++) {
        const t = Math.sin(Math.PI * (i / count - 0.5));
        side.push([length * t, rho(t) * sz]);
      }
      return [...side, ...side.slice(1, -1).reverse().map(([a, b]) => [a, -b])];
    }
    const RIM = { map: ([a, b]) => [a, 0, b], normal: V3(0, 1, 0) };

    // Cut-open shell: outer wall, double-membrane rim and inner surface.
    function openShell(parent, { length, radius, q, sy, sz, wall, outer, rimDark, rimGap, inner }) {
      addMesh(lathe(length, radius, q, sy, sz, { half: true }), outer, parent);
      const loops = [0, wall * 0.36, wall * 0.64, wall].map(d => latheLoop(length - d, radius - d, q, sz));
      addMesh(band(loops[0], loops[1], RIM.map, true, RIM.normal), rimDark, parent);
      addMesh(band(loops[1], loops[2], RIM.map, true, RIM.normal), rimGap, parent);
      addMesh(band(loops[2], loops[3], RIM.map, true, RIM.normal), rimDark, parent);
      addMesh(lathe(length - wall, radius - wall, q, sy, sz, { half: true, inward: true }), inner, parent);
      return profileRadius(radius - wall, q);
    }

    const mitoSurfaces = has("mitochondrion") && {
      outer: material("mitochondrion", C.mito, { roughness: 0.48 }),
      dark: material("mitochondrion", C.mitoDark, { roughness: 0.5 }),
      gap: material("mitochondrion", C.matrix, { roughness: 0.6 }),
      matrix: material("mitochondrion", C.matrix, { roughness: 0.7 }),
      crista: material("mitochondrion", C.crista, { roughness: 0.55 })
    };
    const MITO = { length: 0.3, radius: 0.15, q: 2.7, sy: 0.92, sz: 1 };

    function mitochondrion(face, a, b, angle, cut) {
      const lift = (cut ? MITO.radius * MITO.sy : MITO.radius * MITO.sy) - 0.018;
      const group = place("mitochondrion", face, a, b, angle, lift, 0.34);
      const s = mitoSurfaces;
      if (!cut) {
        addMesh(lathe(MITO.length, MITO.radius, MITO.q, MITO.sy, MITO.sz), s.outer, group);
        return group;
      }
      const wall = 0.03;
      const rho = openShell(group, { ...MITO, wall, outer: s.outer, rimDark: s.dark, rimGap: s.gap, inner: s.matrix });
      const innerLength = MITO.length - wall;
      // Cristae: inner-membrane folds reaching across the matrix from alternating sides.
      [-0.66, -0.4, -0.13, 0.13, 0.4, 0.66].forEach((t, index) => {
        const r = rho(t) * 0.97, side = index % 2 ? -1 : 1;
        const reach = -0.28 * side * r;
        const shape = new THREE.Shape();
        const point = alpha => [r * Math.sin(alpha) * side, r * Math.cos(alpha) * MITO.sy];
        const end = Math.PI + Math.asin(0.28);
        const start = point(Math.PI / 2);
        shape.moveTo(-start[0], -0.006);
        for (let i = 1; i <= 14; i++) {
          const [z, y] = point(Math.PI / 2 + (end - Math.PI / 2) * i / 14);
          shape.lineTo(-z, Math.min(y, -0.006));
        }
        const last = point(end);
        shape.quadraticCurveTo(-reach * 1.12, last[1] * 0.45, -reach, -0.006);
        shape.lineTo(-start[0], -0.006);
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.016, bevelEnabled: false, curveSegments: 6 });
        geometry.rotateY(Math.PI / 2);
        geometry.translate(innerLength * t - 0.008, 0, 0);
        addMesh(geometry, s.crista, group);
      });
      return group;
    }

    const chloroSurfaces = has("chloroplast") && {
      outer: material("chloroplast", senior ? C.chloroplast : C.chloroplastJunior, { roughness: 0.5 }),
      dark: material("chloroplast", C.chloroDark, { roughness: 0.5 }),
      gap: material("chloroplast", C.stroma, { roughness: 0.6 }),
      stroma: material("chloroplast", C.stroma, { roughness: 0.75 }),
      granum: material("chloroplast", C.granum, { roughness: 0.45 }),
      grain: material("chloroplast", 0x3f9a4f, { roughness: 0.5 })
    };
    const CHLORO = { length: 0.33, radius: 0.19, q: 2.15, sy: 0.74, sz: 1 };

    function chloroplast(face, a, b, angle, cut) {
      const lift = CHLORO.radius * CHLORO.sy - 0.02;
      const group = place("chloroplast", face, a, b, angle, lift, 0.4);
      const s = chloroSurfaces;
      if (!cut) {
        addMesh(lathe(CHLORO.length, CHLORO.radius, CHLORO.q, CHLORO.sy, CHLORO.sz), s.outer, group);
        if (!senior) {
          // 初中教材把叶绿体画成含有许多绿色颗粒的椭球体。
          const grains = [];
          for (let i = 0; i < 9; i++) {
            const t = -0.7 + 1.4 * i / 8, z = (i % 3 - 1) * 0.07;
            const rho = profileRadius(CHLORO.radius, CHLORO.q)(t);
            const y = Math.sqrt(Math.max(0, rho * rho - z * z)) * CHLORO.sy;
            grains.push(at(CHLORO.length * t, y - 0.012, z));
          }
          instanced(new THREE.SphereGeometry(0.032, 10, 8), s.grain, group, grains, { cast: false });
        }
        return group;
      }
      const wall = 0.028;
      const rho = openShell(group, { ...CHLORO, wall, outer: s.outer, rimDark: s.dark, rimGap: s.gap, inner: s.stroma });
      const innerLength = CHLORO.length - wall;
      // Grana: stacks of thylakoid discs joined by stroma lamellae.
      const discs = [], stacks = [];
      [-0.56, -0.19, 0.19, 0.56].forEach((t, index) => {
        const x = innerLength * t, z = index % 2 ? 0.025 : -0.025;
        const floor = -Math.sqrt(Math.max(0, rho(t) ** 2 - 0.07 ** 2)) * CHLORO.sy + 0.006;
        const count = Math.max(3, Math.floor((-0.012 - floor) / 0.021));
        for (let i = 0; i < count; i++) discs.push(at(x, floor + 0.008 + i * 0.021, z));
        stacks.push([x, z, floor]);
      });
      instanced(new THREE.CylinderGeometry(0.056, 0.056, 0.015, 20), s.granum, group, discs);
      for (let i = 0; i < stacks.length - 1; i++) {
        const [x1, z1, f1] = stacks[i], [x2, z2, f2] = stacks[i + 1];
        for (const level of [0.03, 0.072]) {
          const y = Math.max(f1, f2) + level;
          tubeAlong([[x1, y, z1], [(x1 + x2) / 2, y + 0.006, (z1 + z2) / 2], [x2, y, z2]], 0.0065, s.granum, group);
        }
      }
      return group;
    }

    function nucleus(face, a, b, radius, lift, angle) {
      const group = place("nucleus", face, a, b, angle, lift, radius + 0.08);
      if (!senior) {
        addMesh(new THREE.SphereGeometry(radius, 48, 32), material("nucleus", C.nucleus, { roughness: 0.5 }), group);
        anchor("nucleus", group, [0, radius * 0.72, radius * 0.6]);
        return group;
      }
      // Envelope with a quarter wedge removed toward the viewer (+x, +z).
      const envelope = material("nucleus", C.nucleus, { roughness: 0.46 });
      addMesh(new THREE.SphereGeometry(radius, 56, 36, Math.PI, Math.PI * 1.5), envelope, group);
      const dark = material("nucleus", C.nucleusDark, { roughness: 0.5 });
      const gap = material("nucleus", 0xf6f1fd, { roughness: 0.6 });
      const plasm = material("nucleus", C.nucleoplasm, { roughness: 0.8 });
      const nucleolusSurface = material("nucleus", C.nucleolus, { roughness: 0.45 });
      const chromatinSurface = material("nucleus", C.chromatin, { roughness: 0.55 });
      const pore = material("nucleus", C.nucleusDark, { roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const rings = [radius, radius - 0.022, radius - 0.037, radius - 0.06];
      const faces = [
        { dir: V3(1, 0, 0), normal: V3(0, 0, 1) },
        { dir: V3(0, 0, 1), normal: V3(1, 0, 0) }
      ];
      const nucleolusRadius = radius * 0.25;
      for (const { dir, normal } of faces) {
        // Half disc: (sin θ · dir, cos θ), θ from the top pole to the bottom pole.
        const map = ([u, v]) => [dir.x * u, v, dir.z * u];
        const arc = r => Array.from({ length: 41 }, (_, i) => {
          const theta = Math.PI * i / 40;
          return [r * Math.sin(theta), r * Math.cos(theta)];
        });
        const loops = rings.map(arc);
        addMesh(band(loops[0], loops[1], map, false, normal), dark, group, NO_CAST);
        addMesh(band(loops[1], loops[2], map, false, normal), gap, group, NO_CAST);
        addMesh(band(loops[2], loops[3], map, false, normal), dark, group, NO_CAST);
        addMesh(fan(loops[3], map, [0, 0], false, normal), plasm, group, NO_CAST);
        // Nuclear pores interrupting the double membrane on the section.
        const offset = normal.clone().multiplyScalar(0.002);
        for (const theta of [0.55, 1.35, 2.25]) {
          const p = V3(Math.sin(theta) * dir.x, Math.cos(theta), Math.sin(theta) * dir.z);
          const gapMesh = addMesh(new THREE.PlaneGeometry(0.034, 0.075), plasm, group, { cast: false });
          gapMesh.position.copy(p.multiplyScalar(radius - 0.03)).add(offset);
          gapMesh.lookAt(gapMesh.position.clone().add(normal));
          gapMesh.rotateZ(-theta * (dir.x ? 1 : -1));
          gapMesh.material = material("nucleus", C.nucleoplasm, { roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
        }
        // Chromatin threads lying on the section.
        const lift = normal.clone().multiplyScalar(0.008);
        for (let strand = 0; strand < 5; strand++) {
          const points = [];
          let u = 0.14 + random() * (radius - 0.32), v = (random() - 0.5) * (radius - 0.2);
          for (let step = 0; step < 7; step++) {
            u = clamp(u + (random() - 0.5) * 0.13, 0.08, radius - 0.13);
            v = clamp(v + (random() - 0.5) * 0.13, -(radius - 0.14), radius - 0.14);
            if (Math.hypot(u, v) > radius - 0.12) { u *= 0.86; v *= 0.86; }
            points.push(V3(...map([u, v])).add(lift));
          }
          tubeAlong(points, 0.0105, chromatinSurface, group, false, 5);
        }
      }
      const nucleolus = addMesh(new THREE.SphereGeometry(nucleolusRadius, 28, 20), nucleolusSurface, group);
      nucleolus.position.set(radius * 0.13, -radius * 0.04, radius * 0.13);
      // Nuclear pores on the outer surface.
      const pores = [], normalAxis = V3(0, 0, 1);
      for (let i = 0; i < 120; i++) {
        const y = 1 - 2 * (i + 0.5) / 120;
        const phi = (i * 2.399963229728653) % (Math.PI * 2);
        const r = Math.sqrt(1 - y * y);
        const n = V3(-Math.cos(phi) * r, y, Math.sin(phi) * r);
        if (n.x > 0.02 && n.z > 0.02) continue;
        if (Math.abs(n.x) < 0.12 && n.z > 0 || Math.abs(n.z) < 0.12 && n.x > 0) continue;
        pores.push(new THREE.Matrix4().compose(n.clone().multiplyScalar(radius + 0.002),
          new THREE.Quaternion().setFromUnitVectors(normalAxis, n), V3(1, 1, 1)));
      }
      instanced(new THREE.TorusGeometry(0.026, 0.0085, 6, 14), dark, group, pores, { cast: false });
      instanced(new THREE.CircleGeometry(0.02, 10), pore, group, pores, { cast: false });
      anchor("nucleus", group, [-radius * 0.26, radius * 0.56, radius * 0.81]);
      return group;
    }

    // A rough ER cisterna: a flattened sac standing on a cut face, swept along a path.
    function sweep(path, up, profileAt, parent, surface) {
      const positions = [], indices = [];
      const count = profileAt(0).length;
      const frames = path.map((point, i) => {
        const prev = path[Math.max(0, i - 1)], next = path[Math.min(path.length - 1, i + 1)];
        const tangent = next.clone().sub(prev).normalize();
        return new THREE.Vector3().crossVectors(tangent, up).normalize();
      });
      path.forEach((point, i) => {
        for (const [pn, pb] of profileAt(i)) {
          const p = point.clone().addScaledVector(frames[i], pn).addScaledVector(up, pb);
          positions.push(p.x, p.y, p.z);
        }
      });
      for (let i = 0; i < path.length - 1; i++) {
        for (let j = 0; j < count; j++) {
          const a = i * count + j, b = i * count + (j + 1) % count;
          indices.push(a, a + count, b, b, a + count, b + count);
        }
      }
      for (const ring of [0, path.length - 1]) {
        const start = positions.length / 3;
        const centre = V3();
        for (let j = 0; j < count; j++) centre.add(V3(...positions.slice((ring * count + j) * 3, (ring * count + j) * 3 + 3)));
        centre.divideScalar(count);
        positions.push(centre.x, centre.y, centre.z);
        for (let j = 0; j < count; j++) indices.push(start, ring * count + j, ring * count + (j + 1) % count);
      }
      const ringVertices = path.length * count;
      addMesh(orient(bufferGeometry(positions, indices), (p, n, i) => (i < ringVertices ? away(path[Math.floor(i / count)])(p, n) : 0)), surface, parent);
      return frames;
    }

    function sacProfile(height, thickness) {
      const points = [];
      const half = thickness / 2;
      points.push([-half, -0.03]);
      for (let i = 0; i <= 8; i++) {
        const angle = Math.PI - Math.PI * i / 8;
        points.push([half * Math.cos(angle), height - half + half * Math.sin(angle)]);
      }
      points.push([half, -0.03]);
      return points;
    }

    function roughER(face, centre, radii, from, to, phase = 0) {
      const id = "endoplasmicReticulum";
      const sheet = material(id, C.er, { roughness: 0.55 });
      const ribosomes = [], layers = [];
      const up = FACE[face].normal;
      radii.forEach((radius, layer) => {
        const path = [], heights = [];
        const steps = 30;
        for (let i = 0; i <= steps; i++) {
          const angle = from + (to - from) * i / steps;
          const r = radius + 0.022 * Math.sin(angle * 5 + layer * 1.7 + phase);
          const [a, b] = [centre[0] + r * Math.cos(angle), centre[1] + r * Math.sin(angle)];
          path.push(V3(...FACE[face].map([a, b])));
          heights.push(0.21 + 0.06 * Math.sin(angle * 3 + layer + phase) - layer * 0.022);
        }
        const thickness = 0.046;
        const frames = sweep(path, up, i => sacProfile(heights[i], thickness), groups.get(id), sheet);
        layers.push({ path, heights });
        if (has("ribosome")) {
          path.forEach((point, i) => {
            if (i % 2 || i === 0 || i === path.length - 1) return;
            for (const side of [-1, 1]) {
              for (let level = 0.05; level < heights[i] - 0.03; level += 0.065) {
                ribosomes.push(point.clone().addScaledVector(frames[i], side * (thickness / 2 + 0.012))
                  .addScaledVector(up, level + (random() - 0.5) * 0.02));
              }
            }
          });
        }
      });
      if (ribosomes.length) {
        instanced(new THREE.SphereGeometry(0.0155, 8, 6), ribosomeSurface(), groups.get("ribosome"),
          ribosomes.map(p => at(p.x, p.y, p.z)), { cast: false });
      }
      return layers;
    }
    // A point on the side of a cisterna, for a label that must land on the ER itself.
    function erPoint(layers, layer, fraction, face = "floor") {
      const { path, heights } = layers[layer];
      const i = Math.round((path.length - 1) * fraction);
      return path[i].clone().addScaledVector(FACE[face].normal, heights[i] * 0.55).toArray();
    }

    let sharedRibosome = null;
    function ribosomeSurface() {
      if (!sharedRibosome) sharedRibosome = material("ribosome", C.ribosome, { roughness: 0.45 });
      return sharedRibosome;
    }

    function smoothER(points) {
      const surface = material("endoplasmicReticulum", C.er, { roughness: 0.5 });
      for (const path of points) tubeAlong(path.map(([a, b]) => FACE.floor.map([a, b], 0.022)), 0.026, surface, groups.get("endoplasmicReticulum"), false, 10);
    }

    function golgi(face, a, b, angle, scale = 1) {
      const group = place("golgi", face, a, b, angle, 0, 0.48 * scale);
      // Cisternae are modelled with the stacking axis along Y, then laid on their side:
      // stack axis → x, long axis → z, short axis → up, tilted slightly toward the viewer.
      const stack = new THREE.Group();
      stack.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(V3(0, 0, 1), V3(1, 0, 0), V3(0, 1, 0)));
      stack.rotateOnWorldAxis(V3(0, 0, 1), 0.32);
      stack.position.set(-0.24 * scale, 0.19 * scale, 0);
      group.add(stack);
      const sac = material("golgi", C.golgi, { roughness: 0.42 });
      const light = material("golgi", C.golgiLight, { roughness: 0.45 });
      for (let layer = 0; layer < 5; layer++) {
        const rx = (0.42 - layer * 0.04) * scale, rz = (0.2 - layer * 0.014) * scale, ry = 0.03 * scale;
        const geometry = new THREE.SphereGeometry(1, 40, 14);
        const position = geometry.getAttribute("position");
        for (let i = 0; i < position.count; i++) {
          const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
          const swell = 1 + 1.1 * x ** 6;
          position.setXYZ(i, x * rx, y * ry * swell + 0.15 * scale * x * x + layer * 0.074 * scale + 0.04 * scale, z * rz * (1 - 0.15 * x * x));
        }
        geometry.computeVertexNormals();
        addMesh(geometry, layer % 2 ? light : sac, stack);
      }
      const vesicles = [[-0.5, 0.2, 0.05, 0.05], [0.5, 0.24, -0.04, 0.048], [-0.44, 0.38, 0.12, 0.04],
        [0.42, 0.42, 0.1, 0.042], [0.05, 0.5, 0.16, 0.045], [-0.2, 0.08, 0.26, 0.04], [0.28, 0.12, -0.26, 0.038]];
      for (const [x, y, z, r] of vesicles) {
        const vesicle = addMesh(new THREE.SphereGeometry(r * scale, 16, 12), light, stack);
        vesicle.position.set(x * scale, y * scale, z * scale);
      }
      anchor("golgi", group, [0, 0.36 * scale, 0]);
      return group;
    }

    function lysosome(face, a, b, radius = 0.1) {
      const group = place("lysosome", face, a, b, 0, radius * 0.86, radius + 0.06);
      addMesh(new THREE.SphereGeometry(radius, 28, 18), material("lysosome", C.lysosome, { roughness: 0.32, transparent: true, opacity: 0.78, depthWrite: false }), group, { cast: true });
      const grains = [];
      for (let i = 0; i < 9; i++) {
        const v = V3(random() - 0.5, random() - 0.5, random() - 0.5).normalize().multiplyScalar(radius * 0.55 * random() + radius * 0.1);
        grains.push(at(v.x, v.y, v.z));
      }
      instanced(new THREE.SphereGeometry(radius * 0.17, 8, 6), material("lysosome", C.lysosomeDark, { roughness: 0.5 }), group, grains, { cast: false });
      return group;
    }

    function centrosome(face, a, b, angle) {
      const group = place("centrosome", face, a, b, angle, 0, 0.32);
      const cloud = addMesh(new THREE.SphereGeometry(1, 28, 16), material("centrosome", C.centroCloud, { transparent: true, opacity: 0.4, depthWrite: false, roughness: 0.7 }), group, { cast: false });
      cloud.scale.set(0.36, 0.2, 0.27);
      cloud.position.set(0.05, 0.07, 0);
      const blade = new THREE.CylinderGeometry(0.011, 0.011, 0.26, 6);
      const surface = material("centrosome", C.centriole, { roughness: 0.45 });
      // Two centrioles at right angles, each of nine microtubule triplets.
      const centrioles = [
        { position: V3(-0.06, 0.095, 0.02), rotation: new THREE.Euler(0, 0, Math.PI / 2) },
        { position: V3(0.19, 0.14, -0.02), rotation: new THREE.Euler(0, 0, 0) }
      ];
      for (const { position, rotation } of centrioles) {
        const base = new THREE.Matrix4().compose(position, new THREE.Quaternion().setFromEuler(rotation), V3(1, 1, 1));
        const transforms = [];
        for (let i = 0; i < 9; i++) {
          const angleAround = i * Math.PI * 2 / 9;
          for (let k = 0; k < 3; k++) {
            const r = 0.066 + k * 0.0075;
            const offset = angleAround + k * 0.2;
            transforms.push(base.clone().multiply(at(Math.cos(offset) * r, 0, Math.sin(offset) * r)));
          }
        }
        instanced(blade, surface, group, transforms);
      }
      anchor("centrosome", group, [0.19, 0.28, -0.02]);
      return group;
    }

    function scatterRibosomes(face, inside, count) {
      if (!has("ribosome")) return [];
      const transforms = [];
      for (let attempt = 0; attempt < count * 30 && transforms.length < count; attempt++) {
        const a = (random() * 2 - 1) * 2.6, b = random() * 1.9;
        if (!inside(a, b)) continue;
        if (occupied[face].some(item => Math.hypot(a - item.a, b - item.b) < item.r)) continue;
        const p = FACE[face].map([a, b], 0.014);
        transforms.push(at(...p));
      }
      instanced(new THREE.SphereGeometry(0.02, 8, 6), ribosomeSurface(), groups.get("ribosome"), transforms, { cast: false });
      return transforms;
    }

    function nearestRibosome(transforms, target) {
      const points = transforms.map(matrix => V3().setFromMatrixPosition(matrix));
      if (points.length) anchors.set("ribosome", points.reduce((best, point) => (point.distanceTo(target) < best.distanceTo(target) ? point : best)));
    }

    /* ---------- Cell bodies ---------- */

    const boundarySurfaces = [];

    // Closed rounded rectangle in the floor plane with fixed sampling, so loops align in bands.
    const LOOP_SAMPLES = { side: 12, corner: 10 };
    function rectLoop(x0, x1, z0, z1, radius) {
      const r = Math.max(0.03, Math.min(radius, (x1 - x0) / 2 - 0.01, (z1 - z0) / 2 - 0.01));
      const corners = [[x1 - r, z1 - r, 0], [x0 + r, z1 - r, 0.5], [x0 + r, z0 + r, 1], [x1 - r, z0 + r, 1.5]];
      const points = [];
      corners.forEach(([cx, cz, start], k) => {
        for (let i = 0; i <= LOOP_SAMPLES.corner; i++) {
          const angle = Math.PI * (start + 0.5 * i / LOOP_SAMPLES.corner);
          points.push([cx + r * Math.cos(angle), cz + r * Math.sin(angle)]);
        }
        const end = Math.PI * (start + 0.5);
        const [nx, nz, nextStart] = corners[(k + 1) % 4];
        const from = [cx + r * Math.cos(end), cz + r * Math.sin(end)];
        const to = [nx + r * Math.cos(Math.PI * nextStart), nz + r * Math.sin(Math.PI * nextStart)];
        for (let i = 1; i < LOOP_SAMPLES.side; i++) {
          points.push([from[0] + (to[0] - from[0]) * i / LOOP_SAMPLES.side, from[1] + (to[1] - from[1]) * i / LOOP_SAMPLES.side]);
        }
      });
      return points;
    }

    // Lower half of a rounded box below the cut plane (y <= 0), closed by a flat bottom.
    function trayShell(x0, x1, z0, z1, radius, depth, edge) {
      const rows = 14;
      const rings = Array.from({ length: rows + 1 }, (_, i) => {
        const y = -depth * Math.sin(i / rows * Math.PI / 2);
        const e = -y - (depth - edge);
        const s = e > 0 ? edge - Math.sqrt(Math.max(0, edge * edge - e * e)) : 0;
        return rectLoop(x0 + s, x1 - s, z0 + s, z1 - s, radius - s).map(([a, b]) => [a, y, b]);
      });
      const count = rings[0].length;
      const centre = V3((x0 + x1) / 2, -depth / 2, (z0 + z1) / 2);
      const side = orient(gridSurface(rows, count, (r, c) => rings[Math.round(r * rows)][Math.round(c * count) % count]), away(centre));
      const bottom = fan(rings[rows].map(([a, , b]) => [a, b]), ([a, b]) => [a, -depth, b], [centre.x, centre.z], true, V3(0, -1, 0));
      return [side, bottom];
    }

    // A raised, softly domed sac over a closed outline (the vacuole above the section).
    function pillow(loop, centre, height) {
      const rows = 12;
      return orient(gridSurface(rows, loop.length, (r, c) => {
        const t = r * Math.PI / 2;
        const k = Math.pow(Math.cos(t), 0.42);
        const [a, b] = loop[Math.round(c * loop.length) % loop.length];
        return [centre[0] + (a - centre[0]) * k, height * Math.sin(t), centre[1] + (b - centre[1]) * k];
      }), away(V3(centre[0], 0, centre[1])));
    }

    if (half && plant) {
      // 1/2 剖切：去掉上半，水平剖面完整呈现；细胞壁半透明，可见下半部的立体厚度。
      const W = 3.3, D = 5.2, depth = 1.0, RC = 0.42, T = 0.14, M = 0.032;
      const inner = { x0: -W / 2 + T + M, x1: W / 2 - T - M, z0: -D / 2 + T + M, z1: D / 2 - T - M };
      const vac = { x0: inner.x0 + 0.42, x1: inner.x1 - 0.42, z0: inner.z0 + 0.42, z1: inner.z1 - 1.5 };
      const vacCentre = [(vac.x0 + vac.x1) / 2, (vac.z0 + vac.z1) / 2];
      const wallShell = material("cellWall", C.wall, { transparent: true, opacity: 0.46, depthWrite: false, roughness: 0.38 });
      const protoplast = material("cellMembrane", 0xd3e6cb, { roughness: 0.72 });
      for (const geometry of trayShell(-W / 2, W / 2, -D / 2, D / 2, RC, depth, 0.3)) addMesh(geometry, wallShell, groups.get("cellWall"), NO_CAST);
      for (const geometry of trayShell(-W / 2 + T, W / 2 - T, -D / 2 + T, D / 2 - T, RC - T, depth - T, 0.24)) addMesh(geometry, protoplast, groups.get("cellMembrane"), NO_CAST);
      const surfaces = {
        wallCut: material("cellWall", C.wallCut, { roughness: 0.78 }),
        wallEdge: material("cellWall", C.wallEdge, { roughness: 0.6 }),
        membrane: material("cellMembrane", C.membrane, { roughness: 0.5 }),
        cytoplasm: material("cytoplasm", C.cytoplasmPlant, { roughness: 0.82 }),
        tonoplast: material("vacuole", C.tonoplast, { roughness: 0.4 }),
        vacuole: material("vacuole", C.vacuole, { roughness: 0.5 }),
        sac: material("vacuole", 0xbfe0f3, { physical: true, transparent: true, opacity: 0.72, depthWrite: false, roughness: 0.14, clearcoat: 0.85, clearcoatRoughness: 0.12 })
      };
      const { map, normal } = FACE.floor;
      const loops = [
        rectLoop(-W / 2, W / 2, -D / 2, D / 2, RC),
        rectLoop(-W / 2 + 0.018, W / 2 - 0.018, -D / 2 + 0.018, D / 2 - 0.018, RC - 0.018),
        rectLoop(-W / 2 + T, W / 2 - T, -D / 2 + T, D / 2 - T, RC - T),
        rectLoop(inner.x0, inner.x1, inner.z0, inner.z1, RC - T - M),
        rectLoop(vac.x0, vac.x1, vac.z0, vac.z1, 0.42),
        rectLoop(vac.x0 + 0.026, vac.x1 - 0.026, vac.z0 + 0.026, vac.z1 - 0.026, 0.394)
      ];
      const ring = (i, surface, id) => addMesh(band(loops[i], loops[i + 1], map, true, normal), surface, groups.get(id), NO_CAST);
      ring(0, surfaces.wallEdge, "cellWall");
      ring(1, surfaces.wallCut, "cellWall");
      ring(2, surfaces.membrane, "cellMembrane");
      ring(3, surfaces.cytoplasm, "cytoplasm");
      ring(4, surfaces.tonoplast, "vacuole");
      addMesh(fan(loops[5], map, vacCentre, true, normal), surfaces.vacuole, groups.get("vacuole"), NO_CAST);
      const sacHeight = 0.3;
      addMesh(pillow(loops[5], vacCentre, sacHeight), surfaces.sac, groups.get("vacuole"), NO_CAST);

      const sdRect = (a, b, box, r) => {
        const cx = (box.x0 + box.x1) / 2, cz = (box.z0 + box.z1) / 2;
        const qx = Math.abs(a - cx) - ((box.x1 - box.x0) / 2 - r), qz = Math.abs(b - cz) - ((box.z1 - box.z0) / 2 - r);
        return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r;
      };
      const insideCytoplasm = (a, b) => sdRect(a, b, inner, 0.25) < -0.05 && sdRect(a, b, vac, 0.42) > 0.05;

      anchor("cellWall", groups.get("cellWall"), [-W / 2 + 0.07, 0.004, -0.58]);
      anchor("cellMembrane", groups.get("cellMembrane"), [W / 2 - T - M / 2, 0.004, 0.27]);
      anchor("cytoplasm", groups.get("cytoplasm"), [-0.95, 0.004, 1.2]);
      anchor("vacuole", groups.get("vacuole"), [vacCentre[0] + 0.3, sacHeight * 0.98, vacCentre[1] - 0.4]);

      const nucleusAt = [0.12, 1.75];
      nucleus("floor", nucleusAt[0], nucleusAt[1], 0.5, 0.2, -0.3);
      const leftX = inner.x0 + 0.21, rightX = inner.x1 - 0.21, backZ = inner.z0 + 0.21;
      const ring2 = [
        ["chloroplast", leftX, -1.7, Math.PI / 2], ["mitochondrion", leftX, -0.95, Math.PI / 2],
        ["chloroplast", leftX, -0.2, Math.PI / 2], ["mitochondrion", leftX, 0.55, Math.PI / 2],
        ["chloroplast", leftX, 1.3, Math.PI / 2], ["chloroplast", -1.18, 2.12, 0.55],
        ["chloroplast", rightX, -1.6, Math.PI / 2], ["mitochondrion", rightX, -0.85, Math.PI / 2],
        ["chloroplast", rightX, -0.1, Math.PI / 2], ["mitochondrion", rightX, 0.65, Math.PI / 2],
        ["chloroplast", -0.55, backZ, 0.02], ["mitochondrion", 0.35, backZ, -0.04],
        ["mitochondrion", 1.28, 2.2, 0.35]
      ];
      let chloroCount = 0, mitoCount = 0;
      for (const [id, a, b, angle] of ring2) {
        if (id === "chloroplast") chloroplast("floor", a, b, angle, senior && chloroCount++ % 2 === 0);
        else mitochondrion("floor", a, b, angle, senior && mitoCount++ !== 3);
      }
      anchor("chloroplast", groups.get("chloroplast").children[2], [0, 0.03, 0]);
      anchor("mitochondrion", groups.get("mitochondrion").children[1], [0, 0.02, 0]);
      if (senior) {
        const er = roughER("floor", nucleusAt, [0.6, 0.72, 0.84], Math.PI * 0.72, Math.PI * 1.2, 0.8);
        for (let i = 0; i < 12; i++) {
          const angle = Math.PI * (0.72 + 0.48 * i / 11);
          occupied.floor.push({ a: nucleusAt[0] + 0.72 * Math.cos(angle), b: nucleusAt[1] + 0.72 * Math.sin(angle), r: 0.18 });
        }
        anchor("endoplasmicReticulum", groups.get("endoplasmicReticulum"), erPoint(er, 2, 0.5));
        golgi("floor", 1.0, 1.66, 0.15, 0.66);
        nearestRibosome(scatterRibosomes("floor", insideCytoplasm, 80), V3(1.35, 0, 1.2));
      }
    } else if (half) {
      // 1/2 剖切的动物细胞：下半为半透明细胞膜包裹的细胞质，水平剖面完整呈现。
      const A = 2.3, B = 1.25, Cz = 1.72, skin = 0.045;
      const wobble = (x, y, z) => {
        const a = Math.atan2(z, x), h = Math.hypot(x, z);
        return 1 + h * (0.03 * Math.sin(3 * a + 0.7) + 0.022 * Math.cos(2 * a - 0.3) + 0.012 * Math.sin(5 * a + 1.9));
      };
      const cellPoint = (theta, phi, inset = 0) => {
        const x = -Math.cos(phi) * Math.sin(theta), y = Math.cos(theta), z = Math.sin(phi) * Math.sin(theta);
        const k = wobble(x, y, z);
        return [(A - inset) * x * k, (B - inset) * y * k, (Cz - inset) * z * k];
      };
      const skinSurface = material("cellMembrane", 0x9fc6db, { physical: true, transparent: true, opacity: 0.42, depthWrite: false, roughness: 0.3, clearcoat: 0.6 });
      const body = material("cytoplasm", 0xf6e4d6, { roughness: 0.62 });
      addMesh(orient(gridSurface(26, 128, (r, c) => cellPoint(Math.PI / 2 + Math.PI / 2 * r, Math.PI * 2 * c)), away(V3())), skinSurface, groups.get("cellMembrane"), NO_CAST);
      addMesh(orient(gridSurface(26, 128, (r, c) => cellPoint(Math.PI / 2 + Math.PI / 2 * r, Math.PI * 2 * c, skin)), away(V3())), body, groups.get("cytoplasm"), NO_CAST);
      const N = 128;
      const loop = inset => Array.from({ length: N }, (_, i) => { const p = cellPoint(Math.PI / 2, Math.PI * 2 * i / N, inset); return [p[0], p[2]]; });
      const outer = loop(0), innerLoop = loop(skin);
      const { map, normal } = FACE.floor;
      addMesh(band(outer, innerLoop, map, true, normal), material("cellMembrane", C.membrane, { roughness: 0.48 }), groups.get("cellMembrane"), NO_CAST);
      addMesh(fan(innerLoop, map, [0, 0], true, normal), material("cytoplasm", C.cytoplasmAnimal, { roughness: 0.84 }), groups.get("cytoplasm"), NO_CAST);
      const membraneAt = outer[Math.round(N * 0.32)];
      anchor("cellMembrane", groups.get("cellMembrane"), [membraneAt[0] * 0.991, 0.004, membraneAt[1] * 0.991]);
      anchor("cytoplasm", groups.get("cytoplasm"), [1.25, 0.004, 0.25]);
      const insideCell = (a, b) => (a / (A - 0.22)) ** 2 + (b / (Cz - 0.2)) ** 2 < 1;

      const nucleusAt = [0.25, -0.05];
      nucleus("floor", nucleusAt[0], nucleusAt[1], 0.66, 0.22, -0.3);
      if (has("mitochondrion")) {
        const list = [[-1.55, 0.75, 0.9], [1.75, -0.35, 1.4], [0.95, -1.2, -0.25], [-0.6, -1.35, 0.15], [1.65, 0.65, -0.6]];
        list.forEach(([a, b, angle], i) => mitochondrion("floor", a, b, angle, senior && i !== 4));
        anchor("mitochondrion", groups.get("mitochondrion").children[0], [0, 0.02, 0]);
      }
      if (senior) {
        roughER("floor", nucleusAt, [0.76, 0.88, 1.0], Math.PI * 0.55, Math.PI * 1.45, 0.4);
        for (let i = 0; i < 20; i++) {
          const angle = Math.PI * (0.55 + 0.9 * i / 19);
          occupied.floor.push({ a: nucleusAt[0] + 0.88 * Math.cos(angle), b: nucleusAt[1] + 0.88 * Math.sin(angle), r: 0.2 });
        }
        anchor("endoplasmicReticulum", groups.get("endoplasmicReticulum"), [nucleusAt[0] + 0.88 * Math.cos(Math.PI * 0.85), 0.24, nucleusAt[1] + 0.88 * Math.sin(Math.PI * 0.85)]);
        smoothER([
          [[-1.9, -0.55], [-1.7, -0.35], [-1.45, -0.42], [-1.22, -0.25], [-1.0, -0.3]],
          [[-1.7, -0.35], [-1.78, -0.1], [-1.6, 0.1], [-1.35, 0.12]],
          [[-1.45, -0.42], [-1.42, -0.18], [-1.6, 0.1]],
          [[-1.22, -0.25], [-1.18, 0.0], [-1.35, 0.12], [-1.3, 0.32]]
        ]);
        occupied.floor.push({ a: -1.45, b: -0.15, r: 0.4 });
        golgi("floor", -0.75, 1.08, 0.55, 0.8);
        if (has("lysosome")) {
          lysosome("floor", -1.25, -0.95, 0.1);
          lysosome("floor", 0.3, 1.45, 0.095);
          lysosome("floor", 2.0, 0.12, 0.085);
          lysosome("floor", 0.15, -1.5, 0.09);
          anchor("lysosome", groups.get("lysosome").children[0], [0, 0.1, 0]);
        }
        if (has("centrosome")) centrosome("floor", 0.95, 0.95, 0.35);
        nearestRibosome(scatterRibosomes("floor", insideCell, 110), V3(1.35, 0, -0.8));
      }
    } else if (plant) {
      const W = 4.9, D = 3.5, H = 2.6, RC = 0.34, RXY = 0.4;
      const T = 0.15, M = 0.032;
      const inner = { left: -W / 2 + T + M, right: W / 2 - T - M };
      const cyto = { left: 0.95, right: 0.42, far: 0.4 };
      const vac = { left: inner.left + cyto.left, right: inner.right - cyto.right };
      const shrink = z => { const e = Math.abs(z) - (D / 2 - RC); return e > 0 ? RC - Math.sqrt(Math.max(0, RC * RC - e * e)) : 0; };
      const section = (z, lower) => {
        const s = shrink(z);
        return halfRect(-W / 2 + s, W / 2 - s, H / 2 - s, RXY - s).map(([a, b]) => [a, lower ? -b : b, z]);
      };
      const zAt = (r, from, to) => from + (to - from) * (0.5 - 0.5 * Math.cos(Math.PI * r));
      const sweepBody = (from, to, lower) => {
        const rows = 40;
        const rings = Array.from({ length: rows + 1 }, (_, i) => section(zAt(i / rows, from, to), lower));
        return orient(gridSurface(rows, rings[0].length - 1, (r, c) => rings[Math.round(r * rows)][Math.round(c * (rings[0].length - 1))]), away(V3()));
      };
      const wallSurface = material("cellWall", C.wall, { roughness: 0.66 });
      addMesh(sweepBody(-D / 2, D / 2, true), wallSurface, groups.get("cellWall"));
      addMesh(sweepBody(-D / 2, 0, false), wallSurface, groups.get("cellWall"));
      const capLower = section(D / 2, true);
      addMesh(fan(capLower.map(p => [p[0], p[1]]), ([a, b]) => [a, b, D / 2], [0, 0], false, V3(0, 0, 1)), wallSurface, groups.get("cellWall"));
      const back = [...section(-D / 2, true), ...section(-D / 2, false).reverse()].map(p => [p[0], p[1]]);
      addMesh(fan(back, ([a, b]) => [a, b, -D / 2], [0, 0], true, V3(0, 0, -1)), wallSurface, groups.get("cellWall"));

      const surfaces = {
        wallCut: material("cellWall", C.wallCut, { roughness: 0.78 }),
        wallEdge: material("cellWall", C.wallEdge, { roughness: 0.6 }),
        membrane: material("cellMembrane", C.membrane, { roughness: 0.5 }),
        cytoplasm: material("cytoplasm", C.cytoplasmPlant, { roughness: 0.82 }),
        tonoplast: material("vacuole", C.tonoplast, { roughness: 0.4 }),
        vacuole: material("vacuole", C.vacuole, { physical: true, roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.25 })
      };
      for (const [face, top, corner] of [["floor", D / 2, RC], ["wall", H / 2, RXY]]) {
        const { map, normal } = FACE[face];
        const outline0 = halfRect(-W / 2, W / 2, top, corner);
        const outline0b = inset(outline0, 0.016);
        const outline1 = halfRect(-W / 2 + T, W / 2 - T, top - T, corner - T);
        const outline2 = halfRect(inner.left, inner.right, top - T - M, corner - T - M);
        const outline3 = halfRect(vac.left, vac.right, top - T - M - cyto.far, 0.36);
        const outline4 = inset(outline3, 0.026);
        addMesh(band(outline0, outline0b, map, false, normal), surfaces.wallEdge, groups.get("cellWall"), NO_CAST);
        addMesh(band(outline0b, outline1, map, false, normal), surfaces.wallCut, groups.get("cellWall"), NO_CAST);
        addMesh(band(outline1, outline2, map, false, normal), surfaces.membrane, groups.get("cellMembrane"), NO_CAST);
        addMesh(band(outline2, outline3, map, false, normal), surfaces.cytoplasm, groups.get("cytoplasm"), NO_CAST);
        addMesh(band(outline3, outline4, map, false, normal), surfaces.tonoplast, groups.get("vacuole"), NO_CAST);
        addMesh(fan(outline4, map, [(vac.left + vac.right) / 2, 0], false, normal), surfaces.vacuole, groups.get("vacuole"), NO_CAST);
      }
      // A thin line marks the edge where the two cut faces meet.
      const sdRect = (a, b, left, right, top, r) => {
        const cx = (left + right) / 2, hx = (right - left) / 2;
        const qx = Math.abs(a - cx) - (hx - r), qy = Math.abs(b) - (top - r);
        return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
      };
      const insideCytoplasm = top => (a, b) => sdRect(a, b, inner.left, inner.right, top - T - M, 0.2) < -0.04
        && sdRect(a, b, vac.left, vac.right, top - T - M - cyto.far, 0.36) > 0.05;

      anchor("cellWall", groups.get("cellWall"), [-W / 2 + 0.06, 0.004, 1.15]);
      anchor("cellMembrane", groups.get("cellMembrane"), [W / 2 - T - M / 2, 0.004, 0.62]);
      anchor("cytoplasm", groups.get("cytoplasm"), [2.02, 0.9, 0.004]);
      anchor("vacuole", groups.get("vacuole"), [0.35, 0.004, 0.55]);

      // Nucleus pressed into the thick cytoplasm beside the wall, bulging toward the vacuole.
      nucleus("floor", -1.79, 0.36, 0.43, 0.2, -0.3);
      if (has("chloroplast")) {
        const cuts = senior ? [true, false] : [false, false];
        let k = 0;
        for (const [face, a, b, angle] of [
          ["floor", 2.07, 0.34, Math.PI / 2], ["floor", 2.07, 1.0, Math.PI / 2],
          ["floor", -1.0, 1.37, 0.05], ["floor", 0.25, 1.38, -0.04], ["floor", 1.45, 1.37, 0.06],
          ["wall", -0.95, 0.92, 0.04], ["wall", 0.3, 0.93, -0.05], ["wall", 1.5, 0.92, 0.03],
          ["wall", 2.07, 0.36, Math.PI / 2]
        ]) chloroplast(face, a, b, angle, cuts[k++ % 2]);
        anchor("chloroplast", groups.get("chloroplast").children[2], [0, 0.03, 0]);
      }
      if (has("mitochondrion")) {
        const list = [["floor", -0.38, 1.38, 0.1], ["floor", 0.85, 1.37, -0.08], ["wall", -0.33, 0.93, 0.08], ["wall", 0.9, 0.93, -0.06]];
        list.forEach(([face, a, b, angle], i) => mitochondrion(face, a, b, angle, senior && i !== 3));
        anchor("mitochondrion", groups.get("mitochondrion").children[1], [0, 0.02, 0]);
      }
      if (senior) {
        roughER("floor", [-1.79, 0.36], [0.49, 0.6], Math.PI * 0.46, Math.PI * 0.7);
        roughER("wall", [-1.79, 0.2], [0.5, 0.61, 0.72], Math.PI * 0.34, Math.PI * 0.69, 1.3);
        anchor("endoplasmicReticulum", groups.get("endoplasmicReticulum"), [-1.79 + 0.67 * Math.cos(Math.PI * 0.5), 0.2 + 0.67 * Math.sin(Math.PI * 0.5), 0.2]);
        golgi("floor", -1.74, 1.36, -0.1, 0.62);
        occupied.floor.push({ a: -1.79, b: 0.95, r: 0.32 }, { a: -2.0, b: 0.8, r: 0.25 });
        occupied.wall.push({ a: -1.79, b: 0.85, r: 0.3 }, { a: -2.05, b: 0.7, r: 0.25 }, { a: -1.4, b: 0.75, r: 0.2 });
        const free = [...scatterRibosomes("floor", insideCytoplasm(D / 2), 44), ...scatterRibosomes("wall", insideCytoplasm(H / 2), 30)];
        nearestRibosome(free, V3(1.98, 0, 1.45));
      }
    } else {
      const A = 2.3, B = 1.32, Cz = 1.72;
      // Gentle irregularity that fades out toward the poles, so the outline stays continuous.
      const wobble = (x, y, z) => {
        const a = Math.atan2(z, x), h = Math.hypot(x, z);
        return 1 + h * (0.024 * Math.sin(3 * a + 0.7) + 0.017 * Math.cos(2 * a - 0.3) + 0.012 * Math.sin(5 * a + 1.9));
      };
      const cellPoint = (theta, phi) => {
        const x = -Math.cos(phi) * Math.sin(theta), y = Math.cos(theta), z = Math.sin(phi) * Math.sin(theta);
        const k = wobble(x, y, z);
        return [A * x * k, B * y * k, Cz * z * k];
      };
      const shell = material("cellMembrane", C.animalSurface, { roughness: 0.5, physical: true, clearcoat: 0.25, clearcoatRoughness: 0.5 });
      addMesh(orient(gridSurface(26, 128, (r, c) => cellPoint(Math.PI / 2 + Math.PI / 2 * r, Math.PI * 2 * c)), away(V3())), shell, groups.get("cellMembrane"));
      addMesh(orient(gridSurface(26, 64, (r, c) => cellPoint(Math.PI / 2 * r, Math.PI + Math.PI * c)), away(V3())), shell, groups.get("cellMembrane"));
      const N = 96;
      const floorOutline = Array.from({ length: N + 1 }, (_, i) => { const p = cellPoint(Math.PI / 2, Math.PI * i / N); return [p[0], p[2]]; });
      const wallOutline = Array.from({ length: N + 1 }, (_, i) => {
        const half = i <= N / 2;
        const theta = half ? Math.PI / 2 * (1 - 2 * i / N) : Math.PI / 2 * (2 * i / N - 1);
        const p = cellPoint(theta, half ? 0 : Math.PI);
        return [p[0], p[1]];
      });
      const membraneBand = material("cellMembrane", C.membrane, { roughness: 0.48 });
      const cytoplasmFace = material("cytoplasm", C.cytoplasmAnimal, { roughness: 0.84 });
      for (const [face, outline] of [["floor", floorOutline], ["wall", wallOutline]]) {
        const { map, normal } = FACE[face];
        const innerOutline = inset(outline, 0.042);
        addMesh(band(outline, innerOutline, map, false, normal), membraneBand, groups.get("cellMembrane"), NO_CAST);
        addMesh(fan(innerOutline, map, [0, 0], false, normal), cytoplasmFace, groups.get("cytoplasm"), NO_CAST);
      }
      const insideCell = top => (a, b) => (a / (A - 0.2)) ** 2 + (b / (top - 0.17)) ** 2 < 1;
      const membraneAt = floorOutline[Math.round(N * 0.73)];
      anchor("cellMembrane", groups.get("cellMembrane"), [membraneAt[0] * 0.991, 0.004, membraneAt[1] * 0.991]);
      anchor("cytoplasm", groups.get("cytoplasm"), [0.64, 0.004, 1.5]);

      nucleus("floor", -0.25, 0.27, 0.64, 0.25, -0.26);
      if (has("mitochondrion")) {
        const list = [["floor", -1.2, 1.12, 0.45], ["floor", 1.72, 0.36, 1.3], ["floor", 1.1, 1.15, -0.42],
          ["wall", 1.25, 0.66, 0.05], ["wall", -1.82, 0.36, 1.25]];
        list.forEach(([face, a, b, angle], i) => mitochondrion(face, a, b, angle, senior && i !== 4));
        anchor("mitochondrion", groups.get("mitochondrion").children[0], [0, 0.02, 0]);
      }
      if (senior) {
        roughER("floor", [-0.25, 0.27], [0.71, 0.83, 0.95, 1.07], Math.PI * 0.57, Math.PI * 1.07, 0.4);
        roughER("wall", [-0.25, 0.25], [0.71, 0.83, 0.95], Math.PI * 0.4, Math.PI * 0.95, 2.1);
        smoothER([
          [[-2.0, 0.36], [-1.85, 0.5], [-1.62, 0.52], [-1.45, 0.66], [-1.31, 0.62]],
          [[-1.85, 0.5], [-1.92, 0.7], [-1.76, 0.87], [-1.56, 0.93]],
          [[-1.62, 0.52], [-1.6, 0.73], [-1.76, 0.87]],
          [[-1.45, 0.66], [-1.42, 0.85], [-1.56, 0.93], [-1.5, 1.1]]
        ]);
        occupied.floor.push({ a: -1.65, b: 0.72, r: 0.35 });
        for (let i = 0; i < 18; i++) {
          const angle = Math.PI * (0.57 + 0.5 * i / 17);
          occupied.floor.push({ a: -0.25 + 0.92 * Math.cos(angle), b: 0.27 + 0.92 * Math.sin(angle), r: 0.2 });
          const wallAngle = Math.PI * (0.4 + 0.55 * i / 17);
          occupied.wall.push({ a: -0.25 + 0.92 * Math.cos(wallAngle), b: 0.25 + 0.92 * Math.sin(wallAngle), r: 0.2 });
        }
        anchor("endoplasmicReticulum", groups.get("endoplasmicReticulum"), [-0.25 + 0.92 * Math.cos(Math.PI * 0.62), 0.25 + 0.92 * Math.sin(Math.PI * 0.62), 0.24]);
        golgi("floor", 0.95, 0.62, 0.35, 0.95);
        if (has("lysosome")) {
          lysosome("floor", -0.45, 1.5, 0.1);
          lysosome("floor", 1.75, 0.98, 0.09);
          lysosome("wall", 0.55, 1.02, 0.1);
          lysosome("wall", 1.98, 0.3, 0.085);
          anchor("lysosome", groups.get("lysosome").children[0], [0, 0.1, 0]);
        }
        if (has("centrosome")) centrosome("floor", 0.28, 1.28, 0.35);
        const free = [...scatterRibosomes("floor", insideCell(Cz), 70), ...scatterRibosomes("wall", insideCell(B), 46)];
        nearestRibosome(free, V3(1.4, 0, 0.78));
      }
    }

    root.updateMatrixWorld(true);
    for (const [id, object, point] of pendingAnchors) anchors.set(id, object.localToWorld(point.clone()));

    const boundaries = [];
    for (const id of ["cellWall", "cellMembrane", "cytoplasm"]) {
      groups.get(id)?.traverse(object => {
        if (object.isMesh && !object.material.transparent) boundaries.push(object);
      });
    }
    const bounds = new THREE.Box3().setFromObject(root);
    // Camera fitting follows the occupied geometry; a small set of directional extrema
    // avoids enlarging the frame for empty box corners.
    const samples = [];
    root.traverse(object => {
      if (!object.isMesh || object.isInstancedMesh) return;
      const points = object.geometry.getAttribute("position");
      const stride = Math.max(1, Math.floor(points.count / 64));
      for (let i = 0; i < points.count; i += stride) {
        samples.push(new THREE.Vector3().fromBufferAttribute(points, i).applyMatrix4(object.matrixWorld));
      }
    });
    const extrema = new Set();
    for (let row = 0; row <= 8; row++) {
      const theta = row * Math.PI / 8;
      for (let col = 0; col < 16; col++) {
        const phi = col * Math.PI / 8;
        const direction = new THREE.Vector3(Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi));
        let best = 0, maximum = -Infinity;
        samples.forEach((point, i) => {
          const distance = point.dot(direction);
          if (distance > maximum) { maximum = distance; best = i; }
        });
        extrema.add(best);
      }
    }
    const fitPoints = [...extrema].map(i => samples[i]);
    return {
      root, anchors, boundaries, bounds, fitPoints,
      highlight(selected, hovered) {
        for (const surface of materials) {
          const id = surface.userData.organelle;
          // Same blue as the 2D diagram's selection glow; large boundary surfaces glow less
          // so the default selection does not recolour the whole cell.
          surface.emissive.setHex(id === selected || id === hovered ? 0x2f6fd6 : 0);
          surface.emissiveIntensity = (id === selected ? 0.3 : 0.14) * (BOUNDARY_IDS.has(id) ? 0.35 : 1);
        }
      },
      dispose() {
        for (const geometry of geometries) geometry.dispose();
        for (const surface of materials) surface.dispose();
      }
    };
  }

  async function create(host, options) {
    const THREE = await import(libraryUrl);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0xffffff, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Neutral tone mapping keeps the pale textbook colours instead of greying them out.
    renderer.toneMapping = THREE.NeutralToneMapping ?? THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xc4ccc8, 1.75));
    const light = new THREE.DirectionalLight(0xffffff, 2.1);
    light.position.set(-3, 7, 5);
    light.castShadow = true;
    const compact = Math.min(window.screen?.width || 1024, window.screen?.height || 1024) < 700;
    light.shadow.mapSize.set(compact ? 1024 : 2048, compact ? 1024 : 2048);
    Object.assign(light.shadow.camera, { left: -4.2, right: 4.2, top: 4.2, bottom: -4.2, near: 1, far: 20 });
    light.shadow.bias = -0.0006;
    light.shadow.normalBias = 0.02;
    light.shadow.radius = 3;
    scene.add(light);
    const fill = new THREE.DirectionalLight(0xe2f0f6, 0.85);
    fill.position.set(1.5, 1.2, 6);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.45);
    rim.position.set(2, 3, -6);
    scene.add(rim);
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = shadowCanvas.height = 128;
    const shadowContext = shadowCanvas.getContext("2d");
    const shadowGradient = shadowContext.createRadialGradient(64, 64, 4, 64, 64, 64);
    shadowGradient.addColorStop(0, "rgba(65, 91, 102, 0.26)");
    shadowGradient.addColorStop(0.55, "rgba(65, 91, 102, 0.11)");
    shadowGradient.addColorStop(1, "rgba(65, 91, 102, 0)");
    shadowContext.fillStyle = shadowGradient;
    shadowContext.fillRect(0, 0, 128, 128);
    const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
    const shadowSurface = new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, toneMapped: false });
    const shadowGeometry = new THREE.PlaneGeometry(1, 1);
    const shadow = new THREE.Mesh(shadowGeometry, shadowSurface);
    shadow.rotation.x = -Math.PI / 2;
    scene.add(shadow);
    const camera = new THREE.OrthographicCamera(-3, 3, 2, -2, 0.1, 40);
    camera.position.set(0, 4.6, 6.4);
    camera.lookAt(0, -0.05, 0);
    const canvas = renderer.domElement;
    canvas.className = "cell-3d-canvas";
    canvas.setAttribute("aria-hidden", "true");
    const overlay = document.createElement("div");
    overlay.className = "cell-3d-labels";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("cell-3d-leaders");
    svg.setAttribute("aria-hidden", "true");
    host.replaceChildren(canvas, svg, overlay);
    const labels = new Map();
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pointers = new Map();
    const events = new AbortController();
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let model = null, disposed = false, dirty = true, labelsVisible = true;
    let selected = "", hovered = "", width = 0, height = 0, pinchDistance = 0, multiTouch = false;
    let view = { ...DEFAULT_VIEW };
    let inertia = null, transition = null;
    const inertiaDamping = 6;
    const resetDuration = 420;

    function layoutLabels() {
      const sides = { left: [], right: [] };
      const projectedLabels = [];
      model.root.updateMatrixWorld(true);
      for (const [id, label] of labels) {
        const anchor = model.anchors.get(id);
        let visible = labelsVisible && Boolean(anchor);
        const world = anchor?.clone().applyMatrix4(model.root.matrixWorld);
        const projected = world?.clone().project(camera);
        if (visible) {
          pointer.set(projected.x, projected.y);
          raycaster.setFromCamera(pointer, camera);
          const boundary = raycaster.intersectObjects(model.boundaries, false)[0];
          const depth = world.clone().sub(raycaster.ray.origin).dot(raycaster.ray.direction);
          visible = !boundary || boundary.distance >= depth - 0.08 || boundary.object.userData.organelle === id;
        }
        label.button.hidden = !visible;
        label.line.style.display = label.dot.style.display = visible ? "" : "none";
        if (!visible) continue;
        const x = (projected.x + 1) * width / 2;
        const y = (1 - projected.y) * height / 2;
        projectedLabels.push({ ...label, x, y });
        label.button.classList.toggle("active", id === selected);
        label.button.classList.toggle("hover", id === hovered);
        label.button.setAttribute("aria-pressed", String(id === selected));
      }
      projectedLabels.sort((a, b) => a.x - b.x);
      projectedLabels.forEach((label, i) => {
        sides[i < Math.ceil(projectedLabels.length / 2) ? "left" : "right"].push(label);
      });
      for (const [side, entries] of Object.entries(sides)) {
        entries.sort((a, b) => a.y - b.y);
        const gap = Math.min(27, (height - 36) / Math.max(1, entries.length));
        let last = 18 - gap;
        for (const entry of entries) { entry.ly = Math.max(clamp(entry.y, 18, height - 18), last + gap); last = entry.ly; }
        last = height - 18 + gap;
        for (const entry of entries.slice().reverse()) { entry.ly = Math.min(entry.ly, last - gap); last = entry.ly; }
        for (const entry of entries) {
          const left = side === "left";
          entry.button.style.left = left ? "8px" : "auto";
          entry.button.style.right = left ? "auto" : "8px";
          entry.button.style.top = `${entry.ly}px`;
          const labelEdge = width < 420 ? 65 : 88;
          const edge = left ? labelEdge : width - labelEdge;
          entry.line.setAttribute("x1", edge);
          entry.line.setAttribute("y1", entry.ly);
          entry.line.setAttribute("x2", entry.x);
          entry.line.setAttribute("y2", entry.y);
          entry.dot.setAttribute("cx", entry.x);
          entry.dot.setAttribute("cy", entry.y);
        }
      }
    }

    function render() {
      if (disposed || !model || !options.isActive() || !width || !height) return;
      model.root.rotation.set(THREE.MathUtils.degToRad(view.pitch), THREE.MathUtils.degToRad(view.yaw), 0, "YXZ");
      model.highlight(selected, hovered);
      model.root.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);
      let halfWidth = 0, halfHeight = 0, bottom = 0;
      for (const point of model.fitPoints) {
        const world = point.clone().applyMatrix4(model.root.matrixWorld);
        bottom = Math.min(bottom, world.y);
        const projected = world.clone().applyMatrix4(camera.matrixWorldInverse);
        halfWidth = Math.max(halfWidth, Math.abs(projected.x));
        halfHeight = Math.max(halfHeight, Math.abs(projected.y));
      }
      const labelReserve = width < 420 ? 69 : 106;
      const usableWidth = Math.max(0.45, 1 - labelReserve * 2 / width);
      const verticalSpan = Math.max(5.2, halfHeight * 2 / 0.84, halfWidth * 2 / usableWidth * height / width);
      const horizontalSpan = verticalSpan * width / height;
      camera.left = -horizontalSpan / 2;
      camera.right = horizontalSpan / 2;
      camera.top = verticalSpan / 2;
      camera.bottom = -verticalSpan / 2;
      shadow.position.y = bottom - 0.12;
      shadow.scale.set(model.bounds.max.x - model.bounds.min.x + 1.2, model.bounds.max.z - model.bounds.min.z + 1.2, 1);
      camera.zoom = view.zoom;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      layoutLabels();
      dirty = false;
    }

    function invalidate() {
      if (disposed) return;
      dirty = true;
      if (motion.matches) render();
      else options.onBusy();
    }

    function resize() {
      const rect = host.getBoundingClientRect();
      if (!rect.width || !rect.height || disposed) return;
      width = rect.width;
      height = rect.height;
      renderer.setSize(width, height, false);
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
      invalidate();
    }

    function normalizedView(next) {
      return {
        yaw: Number.isFinite(next.yaw) ? wrap(next.yaw) : view.yaw,
        pitch: Number.isFinite(next.pitch) ? wrap(next.pitch) : view.pitch,
        zoom: Number.isFinite(next.zoom) ? clamp(next.zoom, 0.65, 1.65) : view.zoom
      };
    }

    function applyView(next, source) {
      view = normalizedView(next);
      options.onView({ ...view, source });
      invalidate();
    }

    function stopMotion() {
      const pending = transition;
      inertia = null;
      transition = null;
      if (!disposed && motion.matches && pending) applyView(pending.target, pending.source);
    }

    function setView(next, source = "api", { animate = false } = {}) {
      if (disposed) return;
      cancelPointers();
      const target = normalizedView(next);
      if (animate && !motion.matches && options.isActive()) {
        transition = { from: { ...view }, target, start: performance.now(), source };
        invalidate();
      } else applyView(target, source);
    }

    function pick(x, y) {
      if (!model || !width || !height) return "";
      const rect = canvas.getBoundingClientRect();
      pointer.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObject(model.root, true);
      const hit = hits.find(item => !item.object.material.transparent
        || !["cellWall", "cellMembrane", "cytoplasm"].includes(item.object.userData.organelle));
      return (hit || hits[0])?.object.userData.organelle || "";
    }

    function setHover(id) {
      if (hovered === id) return;
      hovered = id;
      invalidate();
    }

    function pointerDistance() {
      const [a, b] = [...pointers.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    }

    function cancelPointers() {
      stopMotion();
      const ids = [...pointers.keys()];
      pointers.clear();
      pinchDistance = 0;
      multiTouch = false;
      for (const id of ids) if (host.hasPointerCapture(id)) host.releasePointerCapture(id);
      setHover("");
    }

    function endPointer(event) {
      const stored = pointers.get(event.pointerId);
      if (!stored) return;
      const tap = options.isActive() && event.type === "pointerup" && !multiTouch && stored.distance < 7;
      const samples = stored.samples;
      const last = samples[samples.length - 1];
      const first = samples[0];
      const elapsed = (last.time - first.time) / 1000;
      const releaseAge = event.timeStamp - last.time;
      // A paused drag, cancelled capture or pinch must never launch a spin.
      if (!tap && event.type === "pointerup" && options.isActive() && !motion.matches
        && !multiTouch && pointers.size === 1 && stored.distance >= 7
        && releaseAge >= 0 && releaseAge <= 100 && elapsed > 0) {
        const yaw = clamp((last.x - first.x) * 0.42 / elapsed, -240, 240);
        const pitch = clamp((last.y - first.y) * 0.35 / elapsed, -240, 240);
        if (Math.hypot(yaw, pitch) >= 2) inertia = { yaw, pitch, lastTime: performance.now() };
      }
      pointers.delete(event.pointerId);
      if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId);
      if (tap) {
        const id = pick(event.clientX, event.clientY);
        if (id) options.onSelect(id);
      }
      pinchDistance = pointerDistance();
      if (!pointers.size) multiTouch = false;
      if (inertia) invalidate();
    }

    host.addEventListener("pointerdown", event => {
      if (event.target.closest(".cell-3d-label") || event.button !== 0 || !options.isActive()) return;
      stopMotion();
      options.onInteract();
      host.focus({ preventScroll: true });
      pointers.set(event.pointerId, {
        x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, distance: 0,
        samples: [{ x: event.clientX, y: event.clientY, time: event.timeStamp }]
      });
      if (pointers.size > 1) multiTouch = true;
      pinchDistance = pointerDistance();
      host.setPointerCapture(event.pointerId);
    }, { signal: events.signal });
    host.addEventListener("pointermove", event => {
      if (!options.isActive()) { cancelPointers(); return; }
      const stored = pointers.get(event.pointerId);
      if (!stored) {
        if (event.pointerType === "mouse" && options.isActive()) {
          const id = pick(event.clientX, event.clientY);
          setHover(id);
          options.onHover(id);
        }
        return;
      }
      const dx = event.clientX - stored.x, dy = event.clientY - stored.y;
      stored.x = event.clientX;
      stored.y = event.clientY;
      stored.distance = Math.max(stored.distance, Math.hypot(stored.x - stored.startX, stored.y - stored.startY));
      stored.samples.push({ x: stored.x, y: stored.y, time: event.timeStamp });
      while (stored.samples.length > 2 && stored.samples[0].time < event.timeStamp - 80) stored.samples.shift();
      if (pointers.size > 1) {
        const nextDistance = pointerDistance();
        if (pinchDistance > 0) applyView({ zoom: view.zoom * nextDistance / pinchDistance }, "gesture");
        pinchDistance = nextDistance;
      } else if (stored.distance >= 7 || multiTouch) {
        applyView({ yaw: view.yaw + dx * 0.42, pitch: view.pitch + dy * 0.35 }, "gesture");
      }
    }, { signal: events.signal });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) host.addEventListener(name, endPointer, { signal: events.signal });
    host.addEventListener("pointerleave", () => { setHover(""); options.onHover(""); }, { signal: events.signal });
    host.addEventListener("wheel", event => {
      if (!event.ctrlKey || !options.isActive()) return;
      event.preventDefault();
      event.stopPropagation();
      options.onInteract();
      setView({ zoom: view.zoom * Math.exp(-event.deltaY * 0.002) }, "gesture");
    }, { passive: false, signal: events.signal });
    host.addEventListener("keydown", event => {
      const changes = {
        ArrowLeft: { yaw: view.yaw - 8 }, ArrowRight: { yaw: view.yaw + 8 },
        ArrowUp: { pitch: view.pitch - 8 }, ArrowDown: { pitch: view.pitch + 8 },
        "+": { zoom: view.zoom + 0.1 }, "=": { zoom: view.zoom + 0.1 }, "-": { zoom: view.zoom - 0.1 }, Home: DEFAULT_VIEW
      };
      if (!changes[event.key] || !options.isActive()) return;
      event.preventDefault();
      event.stopPropagation();
      options.onInteract();
      setView(changes[event.key], "keyboard", { animate: event.key === "Home" });
    }, { signal: events.signal });
    canvas.addEventListener("webglcontextlost", event => {
      event.preventDefault();
      options.onLost();
    }, { signal: events.signal });
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    motion.addEventListener("change", () => {
      cancelPointers();
      invalidate();
    }, { signal: events.signal });
    window.addEventListener("blur", cancelPointers, { signal: events.signal });
    window.addEventListener("hashchange", () => { if (!options.isActive()) cancelPointers(); }, { signal: events.signal });
    document.addEventListener("visibilitychange", () => { if (document.hidden) cancelPointers(); }, { signal: events.signal });

    return {
      setModel(type, structures, { cutaway = "quarter" } = {}) {
        cancelPointers();
        if (model) { scene.remove(model.root); model.dispose(); }
        model = buildModel(THREE, type, structures, cutaway);
        scene.add(model.root);
        labels.clear();
        overlay.replaceChildren();
        svg.replaceChildren();
        for (const { id, name } of structures) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "cell-3d-label";
          button.textContent = name;
          button.tabIndex = -1;
          button.addEventListener("pointerdown", event => {
            event.stopPropagation();
            stopMotion();
            options.onInteract();
          });
          button.addEventListener("click", event => { event.stopPropagation(); options.onSelect(id); });
          overlay.append(button);
          const line = document.createElementNS(svg.namespaceURI, "line");
          const dot = document.createElementNS(svg.namespaceURI, "circle");
          dot.setAttribute("r", "2.2");
          svg.append(line, dot);
          labels.set(id, { button, line, dot });
        }
        resize();
        invalidate();
      },
      setView,
      setSelected(id) { if (selected !== id) { stopMotion(); selected = id; invalidate(); } },
      setHover,
      stopMotion,
      cancelInteraction: cancelPointers,
      setLabelsVisible(visible) { if (labelsVisible !== visible) { labelsVisible = visible; invalidate(); } },
      busy: () => !disposed && (dirty || Boolean(inertia) || Boolean(transition)),
      step(dt, auto = false, timestamp = performance.now()) {
        if (disposed) return;
        if (!options.isActive()) { cancelPointers(); return; }
        if (auto) {
          stopMotion();
          applyView({ yaw: view.yaw + Math.min(dt, 0.1) * 16 }, "auto");
        } else if (transition) {
          const { from, target, start, source } = transition;
          const progress = clamp((timestamp - start) / resetDuration, 0, 1);
          const eased = 1 - (1 - progress) ** 3;
          if (progress === 1) transition = null;
          applyView({
            yaw: from.yaw + wrap(target.yaw - from.yaw) * eased,
            pitch: from.pitch + wrap(target.pitch - from.pitch) * eased,
            zoom: from.zoom + (target.zoom - from.zoom) * eased
          }, source);
        } else if (inertia) {
          const elapsed = Math.max(0, (timestamp - inertia.lastTime) / 1000);
          const decay = Math.exp(-inertiaDamping * elapsed);
          const yaw = view.yaw + inertia.yaw * (1 - decay) / inertiaDamping;
          const pitch = view.pitch + inertia.pitch * (1 - decay) / inertiaDamping;
          inertia.yaw *= decay;
          inertia.pitch *= decay;
          inertia.lastTime = timestamp;
          if (Math.hypot(inertia.yaw, inertia.pitch) < 2) inertia = null;
          applyView({ yaw, pitch }, "inertia");
        }
        if (dirty) render();
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        events.abort();
        observer.disconnect();
        cancelPointers();
        model?.dispose();
        shadowTexture.dispose();
        shadowSurface.dispose();
        shadowGeometry.dispose();
        renderer.dispose();
        host.replaceChildren();
      }
    };
  }

  window.MasterLabCell3D = Object.freeze({ create, defaultView: DEFAULT_VIEW });
})();
