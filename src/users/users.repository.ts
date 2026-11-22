import { Inject, Injectable } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { randomUUID } from 'node:crypto';
import { apiError } from '../common/api-error.js';
import type { StoredUser, User } from './user.js';

const seeds: User[] = [
  {
    id: 'u-cli-1',
    name: 'Camila Rojas',
    email: 'cliente@entradasya.bo',
    role: 'customer',
  },
  {
    id: 'u-cli-2',
    name: 'Andrea Vargas',
    email: 'andrea.vargas@entradasya.bo',
    role: 'customer',
  },
  {
    id: 'u-cli-3',
    name: 'Luis Fernando Paz',
    email: 'lfpaz@entradasya.bo',
    role: 'customer',
  },
  {
    id: 'u-org-1',
    name: 'Marcelo Quispe',
    email: 'organizador@entradasya.bo',
    role: 'organizer',
  },
  {
    id: 'u-org-2',
    name: 'Valeria Gutiérrez',
    email: 'valeria@productoraandes.bo',
    role: 'organizer',
  },
  {
    id: 'u-door-1',
    name: 'Diego Mamani',
    email: 'portero@entradasya.bo',
    role: 'doorman',
  },
];

@Injectable()
export class UsersRepository implements OnModuleInit {
  private readonly users = new Map<string, StoredUser>();
  private readonly pendingEmails = new Set<string>();
  constructor(
    @Inject(PasswordHasher) private readonly hasher: PasswordHasher,
  ) {}

  async onModuleInit() {
    for (const seed of seeds) {
      this.users.set(seed.email, {
        ...seed,
        passwordHash: await this.hasher.hash('entradas123'),
      });
    }
  }

  findByEmail(email: string): StoredUser | undefined {
    const user = this.users.get(email);
    return user ? { ...user } : undefined;
  }

  async register(
    name: string,
    email: string,
    password: string,
  ): Promise<StoredUser> {
    // Reserve before yielding to the async hasher: no duplicate email race.
    if (this.users.has(email) || this.pendingEmails.has(email)) {
      apiError(
        409,
        'email_taken',
        'Ya existe una cuenta con ese correo. Ingresa con tu contraseña.',
      );
    }
    this.pendingEmails.add(email);
    try {
      const user: StoredUser = {
        id: randomUUID(),
        name,
        email,
        role: 'customer',
        passwordHash: await this.hasher.hash(password),
      };
      this.users.set(email, user);
      return { ...user };
    } finally {
      this.pendingEmails.delete(email);
    }
  }
}
