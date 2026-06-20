export function BackgroundElements({ variant = "home" }: { variant?: "home" | "signin" | "signup" }) {
  return (
    <div className="background-elements">
      <div className="bg-shape shape-a"></div>
      {variant === "signin" ? <div className="bg-shape shape-b"></div> : <div className="bg-shape shape-b"></div>}
      {variant === "signup" ? <div className="bg-shape shape-c"></div> : variant === "home" ? <div className="bg-shape shape-c"></div> : null}
      <div className="bg-grid"></div>
    </div>
  );
}
