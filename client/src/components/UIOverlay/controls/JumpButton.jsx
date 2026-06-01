export default function JumpButton({ isJumping, jumpVelocity, jumpForce }) {

  const handleJump = () => {
    if (!isJumping.current) {
      isJumping.current = true;
      jumpVelocity.current = jumpForce;
    }
  };

  return (
    <div className="jump-button">
      <button className="btn jump" onTouchStart={handleJump}>
        ⬆ Jump
      </button>
    </div>
  );
}
