import { IsEmail, IsNotEmpty, MaxLength, MinLength, } from "class-validator";
import { ISC } from "src/common/global/ISC";

export class LoginDTO {
  @IsEmail({}, { message: ISC.VALIDATION.EMAIL_INVALID })
  @IsNotEmpty({ message: ISC.VALIDATION.EMAIL_EMPTY })
  @MaxLength(255, { message: ISC.VALIDATION.EMAIL_TOO_LONG })
  email: string;

  @IsNotEmpty({ message: ISC.VALIDATION.PASS_EMPTY })
  @MaxLength(255, { message: ISC.VALIDATION.PASS_TOO_LONG })
  password: string;
}