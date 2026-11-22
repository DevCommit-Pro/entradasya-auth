import { Inject, Injectable } from '@nestjs/common';
import { PasswordHasher, JwtSigner } from '@nestjs/authentication';
import { UsersRepository } from '../users/users.repository.js';
import { publicUser } from '../users/user.js';
import type { StoredUser } from '../users/user.js';
import { apiError } from '../common/api-error.js';
import { parseLogin, parseRegister } from './auth.schemas.js';

@Injectable()
export class AuthService {
  constructor(
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(PasswordHasher) private readonly hasher: PasswordHasher,
    @Inject(JwtSigner) private readonly signer: JwtSigner,
  ) {}

  async register(body: unknown) {
    const { name, email, password } = parseRegister(body);
    return this.response(await this.users.register(name, email, password));
  }

  async login(body: unknown) {
    const { email, password } = parseLogin(body);
    const user = this.users.findByEmail(email);
    const valid = await this.hasher.verify(password, user?.passwordHash);
    if (!valid || !user)
      apiError(
        401,
        'invalid_credentials',
        'El correo o la contraseña no coinciden. Revisa los datos e intenta de nuevo.',
      );
    return this.response(user);
  }

  private response(stored: StoredUser) {
    const user = publicUser(stored);
    return {
      token: this.signer.sign({
        sub: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      }),
      user,
    };
  }
}
