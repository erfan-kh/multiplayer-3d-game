export default function SizeControls({ size, setSize }) {

  function update(axis,value){
    setSize({...size,[axis]:Number(value)});
  }

  return (
    <div>

      <h4>Size</h4>

      <input value={size.x} onChange={(e)=>update("x",e.target.value)} />
      <input value={size.y} onChange={(e)=>update("y",e.target.value)} />
      <input value={size.z} onChange={(e)=>update("z",e.target.value)} />

    </div>
  );
}
