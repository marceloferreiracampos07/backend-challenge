import { plateSchema } from './plate.schema';

describe('plateSchema', () => {
  it('normaliza a placa removendo hífen e convertendo para maiúsculas', () => {
    expect(plateSchema.parse('abc-1d23')).toBe('ABC1D23');
    expect(plateSchema.parse('  def2g34  ')).toBe('DEF2G34');
  });

  it('rejeita caracteres inválidos', () => {
    expect(plateSchema.safeParse('ABC 123').success).toBe(false);
    expect(plateSchema.safeParse('ABC@123').success).toBe(false);
  });

  it('rejeita placas com menos de 3 ou mais de 7 caracteres', () => {
    expect(plateSchema.safeParse('AB').success).toBe(false);
    expect(plateSchema.safeParse('ABCD1234').success).toBe(false);
  });
});
