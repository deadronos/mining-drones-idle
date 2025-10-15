export function GlobalProvider({ children }: { children?: React.ReactNode }) {
  return children;
}

export function CanvasProvider({ children }: { children?: React.ReactNode }) {
  return children;
}

/* Configure the environment as needed. Here we set up Rapier physics.
import { Physics } from "@react-three/rapier";
 
export function CanvasProvider({
  children,
}: {
  children?: React.ReactNode;
}) {
  return <Physics>{children}</Physics>;
} 

*/
