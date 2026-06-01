export default function PositionControls({ position, setPosition }) {

  function update(axis,value){
    setPosition({...position,[axis]:Number(value)});
  }

  return (
    <div>

      <h4>Position</h4>

      <input value={position.x} onChange={(e)=>update("x",e.target.value)} />
      <input value={position.y} onChange={(e)=>update("y",e.target.value)} />
      <input value={position.z} onChange={(e)=>update("z",e.target.value)} />

    </div>
  );
}
