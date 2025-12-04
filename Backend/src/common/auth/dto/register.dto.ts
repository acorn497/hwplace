import { IsEmail, IsNotEmpty, Length, MaxLength } from "class-validator";

export class RegisterDTO {
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email: string;

  @IsNotEmpty()
  @Length(8, 255)
  password: string;
}