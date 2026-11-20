import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value
  )
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

export class LogoutDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  refresh_token!: string;
}

export class RefreshDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  refresh_token!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  current_password!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/\S/, { message: 'new_password must contain a non-whitespace character' })
  new_password!: string;
}
