import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';

/**
 * Compiles the real DI graph.
 *
 * Nest resolves dependencies at runtime, so a provider injected across a
 * module boundary without being exported compiles and unit-tests fine, then
 * crash-loops on boot. That shipped: AiMeteringService was a BillingModule
 * provider injected by five services elsewhere but missing from its exports,
 * and nothing caught it until Render refused to start.
 *
 * This never touches the database -- compile() wires providers, it does not
 * connect them.
 */
describe('application wiring', () => {
  it('resolves every provider in the module graph', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  }, 60000);
});
