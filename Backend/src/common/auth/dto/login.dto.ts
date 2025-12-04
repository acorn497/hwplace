import { IsEmail, IsNotEmpty, Length, MaxLength } from "class-validator";

export class LoginDTO {
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email: string;

  @IsNotEmpty()
  @Length(8, 255)
  password: string;
}