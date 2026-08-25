import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateLocationDto } from './update-location.dto';

describe('UpdateLocationDto', () => {
  it('accepts a well-formed location update', async () => {
    const dto = plainToInstance(UpdateLocationDto, {
      latitude: 37.7749,
      longitude: -122.4194,
      accuracy: 15,
      timestamp: new Date().toISOString(),
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts a location update with only latitude/longitude', async () => {
    const dto = plainToInstance(UpdateLocationDto, { latitude: 0, longitude: 0 });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects an out-of-range latitude', async () => {
    const dto = plainToInstance(UpdateLocationDto, { latitude: 200, longitude: 0 });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'latitude')).toBe(true);
  });

  it('rejects an out-of-range longitude', async () => {
    const dto = plainToInstance(UpdateLocationDto, { latitude: 0, longitude: -200 });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'longitude')).toBe(true);
  });

  it('rejects a negative accuracy value', async () => {
    const dto = plainToInstance(UpdateLocationDto, { latitude: 0, longitude: 0, accuracy: -5 });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'accuracy')).toBe(true);
  });

  it('rejects an unreasonably large accuracy value', async () => {
    const dto = plainToInstance(UpdateLocationDto, { latitude: 0, longitude: 0, accuracy: 999_999 });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'accuracy')).toBe(true);
  });

  it('rejects a malformed timestamp', async () => {
    const dto = plainToInstance(UpdateLocationDto, { latitude: 0, longitude: 0, timestamp: 'not-a-date' });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'timestamp')).toBe(true);
  });
});
