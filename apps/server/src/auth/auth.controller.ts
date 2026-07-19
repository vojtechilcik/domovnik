import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Zaregistrovat nového uživatele (pronajímatel nebo nájemník)' })
  async register(@Body() body: { email: string; password: string; name: string; role: 'LANDLORD' | 'TENANT' }) {
    return this.authService.register(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Přihlásit se emailem a heslem' })
  async login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obnovit access token pomocí refresh tokenu' })
  async refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refreshToken(body.refreshToken);
  }

  @Post('invite')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Poslat pozvánku nájemníkovi (pouze LANDLORD)' })
  async invite(@Body() body: { landlordId: string; email: string; tenancyId: string }) {
    return this.authService.inviteTenant(body.landlordId, { email: body.email, tenancyId: body.tenancyId });
  }

  @Post('accept-invite')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Přijmout pozvánku a vytvořit účet nájemníka' })
  async acceptInvite(@Body() body: { token: string; password: string }) {
    return this.authService.acceptInvite(body.token, body.password);
  }
}