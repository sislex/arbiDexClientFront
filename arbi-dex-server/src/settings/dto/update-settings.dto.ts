import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsIn } from 'class-validator';

export class UpdateSettingsDto {
  @ApiProperty({
    description: 'Тема интерфейса',
    enum: ['light', 'dark'],
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsIn(['light', 'dark'])
  theme?: string;

  @ApiProperty({
    description: 'Плотность интерфейса',
    enum: ['default', 'compact'],
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsIn(['default', 'compact'])
  density?: string;

  @ApiProperty({
    description: 'Состояние бокового меню',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  sidebarOpened?: boolean;
}

