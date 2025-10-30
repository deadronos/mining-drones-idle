import { useStore } from '@/state/store';
import { FactoryModel } from './FactoryModel';
import { FactoryTransferFX } from './FactoryTransferFX';

export const Factory = () => {
  const factories = useStore((state) => state.factories);

  return (
    <>
      {factories.map((factory) => (
        <FactoryModel key={factory.id} factory={factory} />
      ))}
      <FactoryTransferFX />
    </>
  );
};
