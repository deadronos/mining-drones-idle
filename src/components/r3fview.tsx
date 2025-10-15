import * as RC from 'render-composer'


function R3FView() {
  return (
    <RC.Canvas strict>
      <RC.RenderPipeline>
        <mesh>
        <dodecahedronGeometry />
        <meshStandardMaterial />
      </mesh>
      </RC.RenderPipeline>
    </RC.Canvas>

  );
}

export default R3FView;
