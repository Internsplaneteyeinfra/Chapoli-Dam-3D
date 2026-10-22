import re

with open('src/components/Scene3D/ReservoirCanvas.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

new_block = '''// View Preset Helpers
  const setTopView = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(0, 1500, 0.1);
    controlsRef.current.target.set(0, 34, 0);
    cameraRef.current.lookAt(0, 34, 0);
    controlsRef.current.update();
  };

  const setSideView = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(0, 90, 1150);
    controlsRef.current.target.set(0, 35, 0);
    cameraRef.current.lookAt(0, 35, 0);
    controlsRef.current.update();
  };

  const setPerspectiveView = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(0, 560, 880);
    controlsRef.current.target.set(0, 34, 0);
    cameraRef.current.lookAt(0, 34, 0);
    controlsRef.current.update();
  };

  const setLowObliqueView = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(100, 160, 520);
    controlsRef.current.target.set(0, 32, 0);
    cameraRef.current.lookAt(0, 32, 0);
    controlsRef.current.update();
  };

  const resetNorth = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    const r = cameraRef.current.position.distanceTo(controlsRef.current.target);
    cameraRef.current.position.set(0, 560, r);
    controlsRef.current.update();
  };'''

new_buttons = '''{/* Viewport Presets Control HUD */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          display: 'flex',
          gap: 6,
          zIndex: 40,
          background: 'rgba(10, 18, 36, 0.85)',
          padding: 6,
          borderRadius: 8,
          border: '1px solid rgba(56, 189, 248, 0.25)',
          backdropFilter: 'blur(10px)'
        }}
      >
        <button
          className="btn-secondary"
          onClick={setPerspectiveView}
          style={{ padding: '4px 10px', fontSize: 11 }}
          title="3D Natural Oblique Perspective View"
        >
          Perspective
        </button>
        <button
          className="btn-secondary"
          onClick={setTopView}
          style={{ padding: '4px 10px', fontSize: 11 }}
          title="Orthogonal Top Plan View (Checking KML Boundary)"
        >
          Top Plan
        </button>
        <button
          className="btn-secondary"
          onClick={setLowObliqueView}
          style={{ padding: '4px 10px', fontSize: 11 }}
          title="Low Oblique View (Inspecting Basin Depth)"
        >
          Basin Depth
        </button>
        <button
          className="btn-secondary"
          onClick={setSideView}
          style={{ padding: '4px 10px', fontSize: 11 }}
          title="Side Profile View (Dam Embankment)"
        >
          Side Profile
        </button>
        <button
          className="btn-secondary"
          onClick={setPerspectiveView}
          style={{ padding: '4px 8px', fontSize: 11, color: 'var(--accent-cyan)' }}
          title="Reset Camera to Default Perspective"
        >
          Reset
        </button>
      </div>

      '''

content = re.sub(r'// View Preset Helpers.*?(?=\n\s*return)', new_block, content, flags=re.DOTALL)
content = re.sub(r'{\s*/\* Viewport Presets Control HUD \*/\s*}.*?(?={\s*/\* Hover Floating Tooltip)', new_buttons, content, flags=re.DOTALL)

with open('src/components/Scene3D/ReservoirCanvas.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated successfully with regex!')
