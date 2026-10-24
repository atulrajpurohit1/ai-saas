import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

/**
 * Validates that a numeric property is an exact multiple of `base`.
 *
 * Used for money fields that are only ever quoted in round units — e.g.
 * insurance coverage amounts, which must end in "00" (a multiple of 100), so a
 * stray "15001" can't be saved. Undefined/null values pass (pair with
 * @IsOptional); non-finite numbers fail.
 */
export function IsMultipleOf(
  base: number,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isMultipleOf',
      target: object.constructor,
      propertyName,
      constraints: [base],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (value === undefined || value === null) return true;
          const [divisor] = args.constraints as [number];
          return (
            typeof value === 'number' &&
            Number.isFinite(value) &&
            divisor > 0 &&
            value % divisor === 0
          );
        },
        defaultMessage(args: ValidationArguments) {
          const [divisor] = args.constraints as [number];
          return `${args.property} must be a multiple of ${divisor}`;
        },
      },
    });
  };
}
