
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export enum AuctionModeInput {
  EXISTING_LEAGUE = 'EXISTING_LEAGUE',
  CUSTOM = 'CUSTOM',
}

export enum AuctionVisibilityInput {
  PRIVATE = 'PRIVATE',
  PUBLIC = 'PUBLIC',
}

export class CreateAuctionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsEnum(AuctionModeInput)
  mode!: AuctionModeInput;

  @IsEnum(AuctionVisibilityInput)
  visibility: AuctionVisibilityInput = AuctionVisibilityInput.PRIVATE;

  @ValidateIf((o) => o.mode === AuctionModeInput.EXISTING_LEAGUE)
  @IsString()
  @IsNotEmpty()
  leagueId?: string;

  @ValidateIf((o) => o.mode === AuctionModeInput.EXISTING_LEAGUE)
  @IsString()
  @IsNotEmpty()
  season?: string;
}
