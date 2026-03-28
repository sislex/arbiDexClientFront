import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh-токен полученный при авторизации',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

