export default function RotationControls({ rotation, setRotation }) {

  function update(axis,value){
    setRotation({...rotation,[axis]:Number(value)});
  }

  return (
    <div>

      <h4>Rotation</h4>

      <input value={rotation.x} onChange={(e)=>update("x",e.target.value)} />
      <input value={rotation.y} onChange={(e)=>update("y",e.target.value)} />
      <input value={rotation.z} onChange={(e)=>update("z",e.target.value)} />

    </div>
  );
}
