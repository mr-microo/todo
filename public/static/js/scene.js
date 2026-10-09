export async function initScene() {
  const canvas = document.querySelector("#scene");
  if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  let renderer, geometry, material, innerGeometry, innerMaterial, frame = 0, observer, onPointerMove;
  try {
    const THREE = await import("three");
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100); camera.position.z = 10;
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    const group = new THREE.Group(); scene.add(group);
    geometry = new THREE.IcosahedronGeometry(2.45, 2);
    material = new THREE.MeshBasicMaterial({ color: 0x78917d, wireframe: true, transparent: true, opacity: 0.11 });
    const orb = new THREE.Mesh(geometry, material); group.add(orb);
    innerGeometry = new THREE.IcosahedronGeometry(1.8, 1);
    innerMaterial = new THREE.MeshBasicMaterial({ color: 0xc17a4d, wireframe: true, transparent: true, opacity: 0.035 });
    const inner = new THREE.Mesh(innerGeometry, innerMaterial); group.add(inner);
    function resize() { const width = window.innerWidth, height = window.innerHeight; renderer.setSize(width, height, false); camera.aspect = width / height; camera.position.x = width < 700 ? 3.5 : 5; camera.position.y = width < 700 ? 3.2 : 1.7; camera.updateProjectionMatrix(); }
    resize(); observer = new ResizeObserver(resize); observer.observe(document.body);
    let pointerX = 0, pointerY = 0; onPointerMove = (event) => { pointerX = (event.clientX / window.innerWidth - .5) * .14; pointerY = (event.clientY / window.innerHeight - .5) * .14; }; window.addEventListener("pointermove", onPointerMove, { passive: true });
    function animate() { frame = requestAnimationFrame(animate); group.rotation.y += .0005; group.rotation.x += .0002; group.position.x += (pointerX - group.position.x * .01) * .012; group.position.y += (-pointerY - group.position.y * .01) * .012; renderer.render(scene, camera); }
    animate();
  } catch {
    canvas.style.display = "none";
  }
  return () => { cancelAnimationFrame(frame); observer?.disconnect(); window.removeEventListener("pointermove", onPointerMove); geometry?.dispose(); material?.dispose(); innerGeometry?.dispose(); innerMaterial?.dispose(); renderer?.dispose(); };
}
