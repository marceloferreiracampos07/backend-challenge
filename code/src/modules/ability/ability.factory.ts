import { AbilityBuilder } from '@casl/ability';
import { createPrismaAbility } from '@casl/prisma';
import { Injectable } from '@nestjs/common';
import { Role } from 'src/common/enums/role.enum';
import { AuthUser } from 'src/common/interfaces/auth-user.interface';
import { AppAbility } from './app.ability';

@Injectable()
export class AbilityFactory {
  createForUser(user: AuthUser): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createPrismaAbility);

    if (user.role === Role.ADMIN) {
      can('manage', 'all');
    } else if (user.companyId) {
      const companyId = user.companyId;
      const companyScope = { companyId };
      const refuelingScope = { vehicle: { companyId } };

      can('read', 'Company', { id: companyId });

      if (user.role === Role.MANAGER) {
        can('manage', ['User', 'Vehicle'], companyScope);
        can('manage', 'Refueling', refuelingScope);
      } else {
        can('read', ['User', 'Vehicle'], companyScope);
        can('read', 'Refueling', refuelingScope);
      }
    }

    return build();
  }
}
