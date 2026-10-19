import { plateSchema } from './plate.schema';

describe('plateSchema', () => {
  it('normaliza a placa removendo hífen e convertendo para maiúsculas (Mercosul e Tradicional)', () => {
    expect(plateSchema.parse('abc-1d23')).toBe('ABC1D23');
    expect(plateSchema.parse('abc-1234')).toBe('ABC1234');
    expect(plateSchema.parse('  def2g34  ')).toBe('DEF2G34');
    expect(plateSchema.parse('xyz9876')).toBe('XYZ9876');
  });

  it('rejeita caracteres inválidos', () => {
    expect(plateSchema.safeParse('ABC 123').success).toBe(false);
    expect(plateSchema.safeParse('ABC@123').success).toBe(false);
  });

  it('rejeita placas com formato inválido', () => {
    expect(plateSchema.safeParse('AB').success).toBe(false);
    expect(plateSchema.safeParse('ABC').success).toBe(false);
    expect(plateSchema.safeParse('1234567').success).toBe(false);
    expect(plateSchema.safeParse('ABCD1234').success).toBe(false);
  });
});
