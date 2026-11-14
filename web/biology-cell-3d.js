/* Cutaway teaching models. All geometry is local and uses the existing structure IDs. */
(() => {
  "use strict";
  const libraryUrl = new URL("vendor/three-0.185.1/three.module.min.js", document.currentScript.src).href;
  const DEFAULT_VIEW = Object.freeze({ yaw: -30, pitch: 10, zoom: 1 });
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const wrap = value => ((value + 180) % 360 + 360) % 360 - 180;

  function buildModel(THREE, type, structures) {
    const root = new THREE.Group();
    const groups = new Map();
    const anchors = new Map();
    const materials = new Set();
    const geometries = new Set();
    const available = new Set(structures.map(item => item.id));
    const senior = available.has("endoplasmicReticulum");
    const plant = type === "plant";
    const palette = {
      cellWall: 0xc6d9a8, cellMembrane: 0x397b91, cytoplasm: 0xd9ded0,
      vacuole: 0xacd4df, nucleus: 0xb7a2db, chloroplast: 0x78ad6e,
      mitochondrion: 0xefb384, endoplasmicReticulum: 0x82a9cb,
      golgi: 0xd9aa4f, ribosome: 0x69508d, lysosome: 0xdca8bd, centrosome: 0x479c8d
    };
    for (const { id } of structures) {
      const group = new THREE.Group();
      group.userData.organelle = id;
      groups.set(id, group);
      root.add(group);
    }

    function material(id, options = {}) {
      const Surface = id === "vacuole" ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
      const surface = new Surface({
        color: palette[id], roughness: 0.53, metalness: 0, ...options
      });
      surface.userData.organelle = id;
      materials.add(surface);
      return surface;
    }

    function mesh(id, geometry, surface, position = [0, 0, 0], parent = groups.get(id)) {
      geometries.add(geometry);
      const object = new THREE.Mesh(geometry, surface);
      object.position.set(...position);
      object.userData.organelle = id;
      parent.add(object);
      return object;
    }

    function localGroup(id, position, angle = 0) {
      const group = new THREE.Group();
      group.position.set(...position);
      group.rotation.y = angle;
      groups.get(id).add(group);
      return group;
    }

    function ellipsoid(id, center, radii, surface, angle = 0, parent = groups.get(id)) {
      const object = mesh(id, new THREE.SphereGeometry(1, 32, 20), surface, center, parent);
      object.scale.set(...radii);
      object.rotation.y = angle;
      return object;
    }

    function tube(id, points, radius, surface, parent = groups.get(id), closed = false) {
      const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)), closed);
      return mesh(id, new THREE.TubeGeometry(curve, Math.max(24, points.length * 3), radius, 6, closed), surface, [0, 0, 0], parent);
    }

    function roundedRect(width, depth, radius) {
      const shape = new THREE.Shape();
      const x = -width / 2, z = -depth / 2;
      shape.moveTo(x + radius, z);
      shape.lineTo(x + width - radius, z);
      shape.quadraticCurveTo(x + width, z, x + width, z + radius);
      shape.lineTo(x + width, z + depth - radius);
      shape.quadraticCurveTo(x + width, z + depth, x + width - radius, z + depth);
      shape.lineTo(x + radius, z + depth);
      shape.quadraticCurveTo(x, z + depth, x, z + depth - radius);
      shape.lineTo(x, z + radius);
      shape.quadraticCurveTo(x, z, x + radius, z);
      return shape;
    }

    function plate(id, shape, height, y, surface, bevel = 0) {
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: height, bevelEnabled: bevel > 0, bevelSize: bevel,
        bevelThickness: bevel, bevelSegments: 3, curveSegments: 12
      });
      geometry.rotateX(-Math.PI / 2);
      return mesh(id, geometry, surface, [0, y, 0]);
    }

    function perimeter(width, depth, radius, y) {
      return roundedRect(width, depth, radius).getSpacedPoints(96).slice(0, -1)
        .map(point => [point.x, y, point.y]);
    }

    function outline(id, width, depth, radius, y, surface, thickness) {
      tube(id, perimeter(width, depth, radius, y), thickness, surface, groups.get(id), true);
    }

    function bowl(id, levels, surface) {
      const positions = [], indices = [];
      const rings = levels.map(([width, depth, radius, y]) => perimeter(width, depth, radius, y));
      const count = rings[0].length;
      for (const ring of rings) for (const point of ring) positions.push(...point);
      for (let row = 0; row < rings.length - 1; row++) {
        for (let i = 0; i < count; i++) {
          const a = row * count + i, b = row * count + (i + 1) % count;
          indices.push(a, a + count, b, b, a + count, b + count);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      mesh(id, geometry, surface);
    }

    function instancedSpheres(id, positions, radius, surface) {
      if (!positions.length) return;
      const geometry = new THREE.SphereGeometry(radius, 8, 6);
      geometries.add(geometry);
      const instances = new THREE.InstancedMesh(geometry, surface, positions.length);
      const transform = new THREE.Matrix4();
      positions.forEach((point, index) => {
        transform.makeTranslation(...point);
        instances.setMatrixAt(index, transform);
      });
      instances.instanceMatrix.needsUpdate = true;
      instances.userData.organelle = id;
      groups.get(id).add(instances);
    }

    if (plant) {
      const wall = material("cellWall", { transparent: true, opacity: 0.49, depthWrite: false, side: THREE.DoubleSide });
      bowl("cellWall", [[3.08, 5.18, 0.48, 0.03], [3.08, 5.18, 0.48, -0.13],
        [2.98, 5.08, 0.46, -0.57], [2.72, 4.82, 0.45, -0.82]], wall);
      plate("cellWall", roundedRect(2.72, 4.82, 0.45), 0.04, -0.84, wall, 0.035);
      const rim = roundedRect(3.08, 5.18, 0.48);
      rim.holes.push(new THREE.Path(roundedRect(2.83, 4.93, 0.39).getPoints().reverse()));
      plate("cellWall", rim, 0.025, 0.025, material("cellWall", { color: 0xcddfb2, transparent: true, opacity: 0.88, depthWrite: false }));
      outline("cellWall", 3.08, 5.18, 0.48, 0.064, material("cellWall", { color: 0x7a9b61 }), 0.009);
      const membrane = material("cellMembrane", { color: 0x8fb4af, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide });
      bowl("cellMembrane", [[2.81, 4.91, 0.39, 0.04], [2.78, 4.88, 0.4, -0.2], [2.56, 4.66, 0.43, -0.7]], membrane);
      outline("cellMembrane", 2.81, 4.91, 0.39, 0.07, material("cellMembrane"), 0.018);
      plate("cytoplasm", roundedRect(2.71, 4.81, 0.4), 0.55, -0.61,
        material("cytoplasm", { color: 0xb8c9bd, transparent: true, opacity: 0.28, depthWrite: false }), 0.045);
      anchors.set("cellWall", new THREE.Vector3(-1.51, 0.03, 1.52));
      anchors.set("cellMembrane", new THREE.Vector3(1.4, 0.07, -1.5));
      anchors.set("cytoplasm", new THREE.Vector3(0.94, -0.04, 1.13));

      // A softly rounded sac leaves a peripheral layer of cytoplasm and space for the nucleus.
      const vacuoleGeometry = new THREE.SphereGeometry(1, 56, 32);
      const vacuolePositions = vacuoleGeometry.getAttribute("position");
      for (let i = 0; i < vacuolePositions.count; i++) {
        const x = vacuolePositions.getX(i), y = vacuolePositions.getY(i), z = vacuolePositions.getZ(i);
        vacuolePositions.setXYZ(i, Math.sign(x) * Math.abs(x) ** 0.55 * 1.04,
          y * 0.31, Math.sign(z) * Math.abs(z) ** 0.55 * 1.6);
      }
      vacuoleGeometry.computeVertexNormals();
      const vacuole = mesh("vacuole", vacuoleGeometry,
        material("vacuole", { color: 0x75aecb, transparent: true, opacity: 0.88, roughness: 0.24,
          clearcoat: 0.35, clearcoatRoughness: 0.22, depthWrite: true }), [0.03, -0.015, -0.65]);
      vacuole.rotation.y = -0.02;
      const vacuoleEdge = Array.from({ length: 80 }, (_, i) => {
        const angle = i * Math.PI * 2 / 80;
        const x = Math.cos(angle), z = Math.sin(angle);
        return [Math.sign(x) * Math.abs(x) ** 0.55 * 1.04 + 0.03, -0.015,
          Math.sign(z) * Math.abs(z) ** 0.55 * 1.6 - 0.65];
      });
      tube("vacuole", vacuoleEdge, 0.008, material("vacuole", { color: 0x6b9eaf, transparent: true, opacity: 0.8, depthWrite: false }), groups.get("vacuole"), true);
      anchors.set("vacuole", new THREE.Vector3(0.12, 0.2, -0.5));
    } else {
      const shell = new THREE.SphereGeometry(1, 64, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
      const membrane = mesh("cellMembrane", shell,
        material("cellMembrane", { color: 0x98b9c4, transparent: true, opacity: 0.58, depthWrite: false, side: THREE.DoubleSide }));
      membrane.scale.set(2.28, 1.08, 1.61);
      const interior = mesh("cytoplasm", shell.clone(),
        material("cytoplasm", { color: 0xe4ded1, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
      interior.scale.set(2.23, 1.01, 1.56);
      const cutFace = mesh("cytoplasm", new THREE.CircleGeometry(1, 64),
        material("cytoplasm", { color: 0xe7e0d2, transparent: true, opacity: 0.35, depthWrite: false }));
      cutFace.rotation.x = -Math.PI / 2;
      cutFace.scale.set(2.22, 1.55, 1);
      cutFace.position.y = 0.008;
      const rim = mesh("cellMembrane", new THREE.TorusGeometry(1, 0.012, 8, 96), material("cellMembrane"));
      rim.rotation.x = Math.PI / 2;
      rim.scale.set(2.28, 1.61, 1);
      anchors.set("cellMembrane", new THREE.Vector3(2.15, 0.01, 0.5));
      anchors.set("cytoplasm", new THREE.Vector3(-1.13, 0.02, 0.8));
    }

    const nucleus = plant ? [-0.53, 0.3, 1.65] : [-0.15, 0.36, -0.13];
    const nucleusRadius = plant ? 0.49 : 0.61;
    const envelopeSurface = material("nucleus", { roughness: 0.38 });
    if (senior) {
      const phiStart = Math.PI * 1.72;
      const phiLength = Math.PI * 1.5;
      const envelope = mesh("nucleus", new THREE.SphereGeometry(nucleusRadius, 48, 32, phiStart, phiLength), envelopeSurface, nucleus);
      mesh("nucleus", new THREE.SphereGeometry(nucleusRadius - 0.035, 48, 32, phiStart, phiLength),
        material("nucleus", { color: 0xd5c8e7, side: THREE.BackSide }), nucleus);
      const edgeSurface = material("nucleus", { color: 0xe8dff5 });
      for (const phi of [phiStart, phiStart + phiLength]) {
        const points = [];
        for (let i = 0; i <= 32; i++) {
          const theta = Math.PI * i / 32;
          points.push([nucleus[0] - nucleusRadius * Math.cos(phi) * Math.sin(theta),
            nucleus[1] + nucleusRadius * Math.cos(theta), nucleus[2] + nucleusRadius * Math.sin(phi) * Math.sin(theta)]);
        }
        tube("nucleus", points, 0.014, edgeSurface);
      }
      ellipsoid("nucleus", [nucleus[0] + 0.04, nucleus[1] - 0.04, nucleus[2]], [0.13, 0.13, 0.13], material("nucleus", { color: 0x72529e }));
      const chromatinSurface = material("nucleus", { color: 0x9272ba });
      for (let i = 0; i < 4; i++) {
        tube("nucleus", [[nucleus[0] - 0.27, nucleus[1] - 0.1 + i * 0.05, nucleus[2] - 0.12 + i * 0.07],
          [nucleus[0] - 0.12, nucleus[1] + 0.03 + i * 0.04, nucleus[2] + 0.05 + i * 0.03],
          [nucleus[0] + 0.22, nucleus[1] - 0.12 + i * 0.04, nucleus[2] + 0.14 - i * 0.06]], 0.012, chromatinSurface);
      }
      const poreGeometry = new THREE.CircleGeometry(0.018, 8);
      geometries.add(poreGeometry);
      const poreTransforms = [];
      const normalAxis = new THREE.Vector3(0, 0, 1);
      for (let i = 0; i < 100; i++) {
        const y = 1 - 2 * (i + 0.5) / 100;
        const phi = (i * 2.399963229728653) % (Math.PI * 2);
        const localPhi = ((phi - phiStart) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        if (localPhi > phiLength) continue;
        const radius = Math.sqrt(1 - y * y);
        const normal = new THREE.Vector3(-Math.cos(phi) * radius, y, Math.sin(phi) * radius);
        const position = normal.clone().multiplyScalar(nucleusRadius + 0.002).add(envelope.position);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(normalAxis, normal);
        poreTransforms.push(new THREE.Matrix4().compose(position, quaternion, new THREE.Vector3(1, 1, 1)));
      }
      const pores = new THREE.InstancedMesh(poreGeometry, material("nucleus", { color: 0x8163b1 }), poreTransforms.length);
      poreTransforms.forEach((transform, i) => pores.setMatrixAt(i, transform));
      pores.instanceMatrix.needsUpdate = true;
      pores.userData.organelle = "nucleus";
      groups.get("nucleus").add(pores);
    } else {
      ellipsoid("nucleus", nucleus, [nucleusRadius, nucleusRadius, nucleusRadius], envelopeSurface);
    }
    anchors.set("nucleus", new THREE.Vector3(nucleus[0], nucleus[1] + nucleusRadius * 0.55, nucleus[2] + nucleusRadius * 0.4));

    const mitochondria = plant
      ? [[0, 0.07, -2.22, 0.04], [1.14, 0.07, -0.2, 1.3], [-1.15, 0.07, 0.55, 1.1], [0.3, 0.07, 2.22, 0.05]]
      : [[-1.18, 0.07, -0.94, 0.08], [1.24, 0.07, -0.6, -0.25], [-0.75, 0.07, 1.13, -0.55], [1.45, 0.07, 0.65, 0.25]];
    const mitoSurface = material("mitochondrion", { roughness: 0.4 });
    const mitoLine = material("mitochondrion", { color: 0xb7774e });
    for (const [index, [x, y, z, angle]] of mitochondria.entries()) {
      const group = localGroup("mitochondrion", [x, y, z], angle);
      if (senior && index !== 1) {
        const body = roundedRect(0.64, 0.28, 0.135);
        const geometry = new THREE.ExtrudeGeometry(body, { depth: 0.08, bevelEnabled: true, bevelSize: 0.018, bevelThickness: 0.018, bevelSegments: 3, curveSegments: 10 });
        geometry.rotateX(-Math.PI / 2);
        mesh("mitochondrion", geometry, mitoSurface, [0, -0.03, 0], group);
        const edge = perimeter(0.59, 0.245, 0.12, 0.071);
        tube("mitochondrion", edge, 0.009, mitoLine, group, true);
        tube("mitochondrion", perimeter(0.52, 0.18, 0.085, 0.072), 0.008, mitoLine, group, true);
        for (let fold = 0; fold < 4; fold++) {
          const fx = -0.17 + fold * 0.105;
          const sign = fold % 2 ? -1 : 1;
          tube("mitochondrion", [[fx, 0.077, sign * 0.087], [fx, 0.077, -sign * 0.035],
            [fx + 0.025, 0.077, -sign * 0.048], [fx + 0.045, 0.077, -sign * 0.033]], 0.008, mitoLine, group);
        }
      } else {
        const capsule = new THREE.CapsuleGeometry(0.14, 0.34, 6, 16);
        capsule.rotateZ(Math.PI / 2);
        capsule.scale(1, 0.9, 1);
        mesh("mitochondrion", capsule, mitoSurface, [0, 0.02, 0], group);
      }
    }
    anchors.set("mitochondrion", new THREE.Vector3(mitochondria[0][0], 0.15, mitochondria[0][2]));

    if (available.has("chloroplast")) {
      const chloroplasts = [[-1.13, 0.07, -1.5, 1.3], [1.12, 0.07, -1.59, 1.6],
        [-1.15, 0.07, -0.5, 1.5], [1.15, 0.07, 0.75, 1.4],
        [-1.07, 0.07, 1.75, 1.1], [0.96, 0.07, -2.13, 0],
        [1.18, 0.07, 2, 1.2], [-0.93, 0.07, -2.12, 0.5]];
      const outer = material("chloroplast", { roughness: 0.42 });
      const cutSurface = material("chloroplast", { color: 0xb2d59c });
      const granumSurface = material("chloroplast", { color: 0x4c8b48 });
      const membraneSurface = material("chloroplast", { color: 0x4e8b48 });
      for (const [index, [x, y, z, angle]] of chloroplasts.entries()) {
        const group = localGroup("chloroplast", [x, y, z], angle);
        ellipsoid("chloroplast", [0, 0, 0], [0.29, 0.145, 0.17], outer, 0, group);
        if (senior && index % 2 === 0) {
          // The exposed section sits above the intact lower part of the double-membrane body.
          const cut = mesh("chloroplast", new THREE.CircleGeometry(1, 40), cutSurface, [0, 0.127, 0], group);
          cut.rotation.x = -Math.PI / 2;
          cut.scale.set(0.275, 0.15, 1);
          const ellipse = (rx, rz, height) => Array.from({ length: 48 }, (_, i) => {
            const angle = i * Math.PI * 2 / 48;
            return [Math.cos(angle) * rx, height, Math.sin(angle) * rz];
          });
          tube("chloroplast", ellipse(0.275, 0.15, 0.129), 0.007, membraneSurface, group, true);
          tube("chloroplast", ellipse(0.248, 0.126, 0.13), 0.005, membraneSurface, group, true);
          tube("chloroplast", [[-0.22, 0.136, 0], [0, 0.136, 0], [0.22, 0.136, 0]], 0.005, granumSurface, group);
          for (let stack = -2; stack <= 2; stack++) {
            for (let layer = 0; layer < 3; layer++) {
              const geometry = new THREE.BoxGeometry(0.035, 0.009, Math.abs(stack) === 2 ? 0.074 : 0.12);
              mesh("chloroplast", geometry, granumSurface, [stack * 0.08, 0.14 + layer * 0.012, 0], group);
            }
          }
        }
      }
      ellipsoid("chloroplast", [-1.08, -0.47, 0.03], [0.23, 0.14, 0.17], outer, 0.3);
      ellipsoid("chloroplast", [0.83, -0.48, 1.95], [0.22, 0.13, 0.15], outer, 1.2);
      anchors.set("chloroplast", new THREE.Vector3(-1.13, 0.22, -1.5));
    }

    if (senior) {
      const erSurface = material("endoplasmicReticulum", { side: THREE.DoubleSide, roughness: 0.68 });
      const erEdge = material("endoplasmicReticulum", { color: 0xe2eaf0 });
      const ribosomeSurface = material("ribosome");
      const boundRibosomes = [];
      const start = Math.PI * 1.05, length = Math.PI * 0.88;
      const thetaStart = Math.PI * 0.2, thetaLength = Math.PI * 0.72;
      for (let layer = 0; layer < 3; layer++) {
        const radius = nucleusRadius + 0.075 + layer * 0.065;
        const geometry = new THREE.SphereGeometry(radius, 30, 18, start, length, thetaStart, thetaLength);
        mesh("endoplasmicReticulum", geometry, erSurface, nucleus);
        for (const theta of [thetaStart, thetaStart + thetaLength]) {
          const points = [];
          for (let i = 0; i <= 32; i++) {
            const phi = start + length * i / 32;
            points.push([nucleus[0] - radius * Math.cos(phi) * Math.sin(theta),
              nucleus[1] + radius * Math.cos(theta), nucleus[2] + radius * Math.sin(phi) * Math.sin(theta)]);
          }
          tube("endoplasmicReticulum", points, 0.01, erEdge);
        }
        for (const phi of [start, start + length]) {
          const points = [];
          for (let i = 0; i <= 24; i++) {
            const theta = thetaStart + thetaLength * i / 24;
            points.push([nucleus[0] - radius * Math.cos(phi) * Math.sin(theta),
              nucleus[1] + radius * Math.cos(theta), nucleus[2] + radius * Math.sin(phi) * Math.sin(theta)]);
          }
          tube("endoplasmicReticulum", points, 0.008, erEdge);
        }
        for (let row = 0; row < 6; row++) {
          for (let col = 0; col < 10; col++) {
            const phi = start + length * (col + 0.5 + row % 2 * 0.3) / 10;
            const theta = thetaStart + thetaLength * (row + 0.5) / 6;
            const r = radius + 0.012;
            boundRibosomes.push([nucleus[0] - r * Math.cos(phi) * Math.sin(theta),
              nucleus[1] + r * Math.cos(theta), nucleus[2] + r * Math.sin(phi) * Math.sin(theta)]);
          }
        }
      }
      instancedSpheres("ribosome", boundRibosomes, 0.014, ribosomeSurface);
      anchors.set("endoplasmicReticulum", new THREE.Vector3(nucleus[0] - 0.42, nucleus[1] + 0.2, nucleus[2] - 0.4));
      if (!plant) {
        tube("endoplasmicReticulum", [[-0.65, 0.1, -0.62], [-0.95, 0.1, -0.92], [-1.31, 0.12, -0.68], [-1.65, 0.1, -0.78]], 0.033, erSurface);
        tube("endoplasmicReticulum", [[-0.92, 0.1, -0.84], [-1.1, 0.15, -0.38], [-1.58, 0.1, -0.24]], 0.033, erSurface);
        tube("endoplasmicReticulum", [[-1.13, 0.12, -0.45], [-1.45, 0.1, -0.57], [-1.73, 0.1, -0.44]], 0.03, erSurface);
      }

      const golgiCenter = plant ? [0.58, 0.1, 1.5] : [-0.93, 0.1, 0.45];
      const golgi = localGroup("golgi", golgiCenter, plant ? -0.15 : 0.45);
      const golgiSurface = material("golgi", { color: 0xc99736, roughness: 0.45 });
      const golgiLight = material("golgi", { color: 0xe4bf66 });
      for (let layer = 0; layer < 6; layer++) {
        const halfWidth = 0.32 - layer * 0.027;
        const points = Array.from({ length: 15 }, (_, i) => {
          const x = -halfWidth + halfWidth * 2 * i / 14;
          return [x + layer * 0.018, layer * 0.065, 0.11 * (1 - (x / halfWidth) ** 2) + layer * 0.023];
        });
        tube("golgi", points, 0.028, golgiSurface, golgi);
        tube("golgi", points.map(([x, y, z]) => [x, y + 0.018, z]), 0.008, golgiLight, golgi);
      }
      for (const [x, y, z, r] of [[-0.36, 0.02, 0, 0.04], [0.38, 0.02, -0.01, 0.035], [-0.29, 0.12, 0.18, 0.033], [0.26, 0.2, 0.21, 0.032]]) {
        ellipsoid("golgi", [x, y, z], [r, r, r], golgiSurface, 0, golgi);
      }
      anchors.set("golgi", new THREE.Vector3(golgiCenter[0], 0.3, golgiCenter[2]));

      const freeRibosomes = [];
      for (let i = 0; i < 280 && freeRibosomes.length < (plant ? 60 : 55); i++) {
        const fract = value => value - Math.floor(value);
        const x = (fract(Math.sin(i * 37.7 + 2) * 43758.5453) * 2 - 1) * (plant ? 1.29 : 2.05);
        const z = (fract(Math.sin(i * 63.1 + 9) * 21583.239) * 2 - 1) * (plant ? 2.3 : 1.4);
        const outside = plant ? false : (x / 2.05) ** 2 + (z / 1.4) ** 2 > 0.9;
        const onVacuole = plant && Math.abs((x - 0.03) / 1.1) ** (2 / 0.55)
          + Math.abs((z + 0.65) / 1.66) ** (2 / 0.55) < 1.06;
        const onNucleus = Math.hypot(x - nucleus[0], z - nucleus[2]) < nucleusRadius + 0.12;
        const onGolgi = Math.hypot(x - golgiCenter[0], z - golgiCenter[2]) < 0.4;
        if (outside || onVacuole || onNucleus || onGolgi) continue;
        freeRibosomes.push([x, 0.07, z]);
      }
      instancedSpheres("ribosome", freeRibosomes, 0.021, ribosomeSurface);
      const ribosomeAnchor = freeRibosomes[2] || boundRibosomes[0];
      anchors.set("ribosome", new THREE.Vector3(...ribosomeAnchor));

      if (available.has("lysosome")) {
        const surface = material("lysosome", { roughness: 0.4 });
        const centers = [[0.95, 0.15, -1.1], [1.55, 0.15, 0.35], [-1.55, 0.15, 0.35], [-1.55, 0.15, 0.86]];
        for (const center of centers) {
          ellipsoid("lysosome", center, [0.078, 0.078, 0.078], surface);
          ellipsoid("lysosome", [center[0] + 0.02, center[1] + 0.057, center[2] + 0.02], [0.017, 0.014, 0.017], material("lysosome", { color: 0xc280a5 }));
        }
        anchors.set("lysosome", new THREE.Vector3(...centers[0]));
      }
      if (available.has("centrosome")) {
        const center = [0.92, 0.13, 0.92];
        const surface = material("centrosome");
        ellipsoid("centrosome", center, [0.3, 0.15, 0.25], material("centrosome", { color: 0x9dcfc2, transparent: true, opacity: 0.25, depthWrite: false }));
        for (let pair = 0; pair < 2; pair++) {
          const centriole = localGroup("centrosome", [center[0] + pair * 0.12 - 0.06, center[1] + pair * 0.04, center[2]]);
          centriole.rotation.z = pair * Math.PI / 2;
          centriole.rotation.x = Math.PI / 2;
          for (let i = 0; i < 9; i++) {
            const angle = i * Math.PI * 2 / 9;
            for (let triplet = 0; triplet < 3; triplet++) {
              const r = 0.049 + triplet * 0.008;
              mesh("centrosome", new THREE.CylinderGeometry(0.006, 0.006, 0.23, 4), surface,
                [Math.cos(angle) * r, 0, Math.sin(angle) * r], centriole);
            }
          }
        }
        anchors.set("centrosome", new THREE.Vector3(center[0], 0.24, center[2]));
      }
    }

    const boundaries = [];
    for (const id of ["cellWall", "cellMembrane", "cytoplasm"]) {
      groups.get(id)?.traverse(object => {
        if (object.isMesh && !object.material.transparent) boundaries.push(object);
      });
    }
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root);
    // Camera fitting follows the occupied geometry, including the raised nucleus.
    // A small set of directional extrema avoids enlarging the frame for empty box corners.
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
          surface.emissive.setHex(id === selected ? 0x29203a : id === hovered ? 0x15252b : 0);
          surface.emissiveIntensity = id === selected ? 0.12 : 0.1;
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
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb5c0b7, 2.1));
    const light = new THREE.DirectionalLight(0xffffff, 2.5);
    light.position.set(-3, 7, 5);
    scene.add(light);
    const fill = new THREE.DirectionalLight(0xc9e4ed, 0.9);
    fill.position.set(3, 2, -4);
    scene.add(fill);
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
      setModel(type, structures) {
        cancelPointers();
        if (model) { scene.remove(model.root); model.dispose(); }
        model = buildModel(THREE, type, structures);
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
