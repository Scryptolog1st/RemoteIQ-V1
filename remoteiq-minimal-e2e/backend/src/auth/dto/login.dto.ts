// backend/src/auth/dto/login.dto.ts
import { IsEmail, IsString, MinLength, MaxLength, Matches } from "class-validator";
import { Transform } from "class-transformer";

export class LoginDto {
    @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
    @IsEmail()
    email!: string;

    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @IsString()
    @MinLength(8)
    @MaxLength(128)
    // Optional: uncomment to require at least one letter and one number/symbol
    // @Matches(/^(?=.*[A-Za-z])(?=.*[\d\W]).+$/, {
    //   message: "password must include letters and numbers or symbols",
    // })
    password!: string;
}
