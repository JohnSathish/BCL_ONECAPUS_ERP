import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import {
  SCHOOL_SIS_PERMISSION_MANAGE,
  SCHOOL_SIS_PERMISSION_READ,
} from './school-sis.constants';
import {
  AdjustStationeryStockDto,
  CancelStationerySaleDto,
  CompleteStationerySaleDto,
  CreateStationeryPurchaseDto,
  CreateStationeryReturnDto,
  ImportStationeryProductsDto,
  SaveStationeryCategoryDto,
  SaveStationeryProductDto,
  SaveStationerySettingsDto,
  SaveStationerySupplierDto,
} from './dto/school-stationery.dto';
import {
  SchoolSisStationeryService,
  type StationeryActor,
} from './school-sis-stationery.service';

function actor(user: JwtUser, req: Request): StationeryActor {
  const perms = user.permissions ?? [];
  const manage =
    perms.includes(SCHOOL_SIS_PERMISSION_MANAGE) || perms.includes('*');
  const roleBlob = (user.roles ?? []).join(' ').toLowerCase();
  return {
    userId: user.sub,
    name: user.email || 'Staff',
    manage,
    cashier:
      /cashier/.test(roleBlob) && !/admin|principal|super/.test(roleBlob),
    admin: /admin|principal|super/.test(roleBlob) || perms.includes('*'),
    ip: req.ip,
  };
}

@ApiBearerAuth()
@ApiTags('school-sis-stationery')
@Controller({ path: 'school-sis/stationery', version: '1' })
export class SchoolSisStationeryController {
  constructor(private readonly store: SchoolSisStationeryService) {}

  @Get('settings')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  settings(@CurrentUser() user: JwtUser) {
    return this.store.getSettings(user.tid);
  }

  @Patch('settings')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  saveSettings(
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
    @Body() dto: SaveStationerySettingsDto,
  ) {
    return this.store.saveSettings(user.tid, dto, actor(user, req));
  }

  @Get('dashboard')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  dashboard(@CurrentUser() user: JwtUser) {
    return this.store.dashboard(user.tid);
  }

  @Get('categories')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  categories(@CurrentUser() user: JwtUser) {
    return this.store.listCategories(user.tid);
  }

  @Post('categories')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  createCategory(
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
    @Body() dto: SaveStationeryCategoryDto,
  ) {
    return this.store.saveCategory(user.tid, dto, actor(user, req));
  }

  @Get('suppliers')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  suppliers(@CurrentUser() user: JwtUser) {
    return this.store.listSuppliers(user.tid);
  }

  @Post('suppliers')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  createSupplier(
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
    @Body() dto: SaveStationerySupplierDto,
  ) {
    return this.store.saveSupplier(user.tid, dto, actor(user, req));
  }

  @Patch('suppliers/:id')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  updateSupplier(
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: SaveStationerySupplierDto,
  ) {
    return this.store.saveSupplier(user.tid, dto, actor(user, req), id);
  }

  @Get('products')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  products(
    @CurrentUser() user: JwtUser,
    @Query('q') q?: string,
    @Query('categoryId') categoryId?: string,
    @Query('stock') stock?: 'LOW' | 'OUT' | 'NORMAL' | 'ALL',
  ) {
    return this.store.listProducts(user.tid, q, categoryId, stock);
  }

  @Get('products/import-template')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  async template(@Res() res: Response) {
    const buf = await this.store.productTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="stationery-products.xlsx"',
    );
    res.send(buf);
  }

  @Post('products/import')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  importProducts(
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
    @Body() dto: ImportStationeryProductsDto,
  ) {
    return this.store.importProducts(user.tid, dto, actor(user, req));
  }

  @Get('products/:id')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  product(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.store.getProduct(user.tid, id);
  }

  @Post('products')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  createProduct(
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
    @Body() dto: SaveStationeryProductDto,
  ) {
    return this.store.saveProduct(user.tid, dto, actor(user, req));
  }

  @Patch('products/:id')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  updateProduct(
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: SaveStationeryProductDto,
  ) {
    return this.store.saveProduct(user.tid, dto, actor(user, req), id);
  }

  @Delete('products/:id')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  removeProduct(
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    return this.store.deactivateProduct(user.tid, id, actor(user, req));
  }

  @Get('students')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  students(@CurrentUser() user: JwtUser, @Query('q') q?: string) {
    return this.store.searchStudents(user.tid, q || '');
  }

  @Get('students/:id/suggested')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  suggested(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.store.suggestedForStudent(user.tid, id);
  }

  @Get('sales')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  sales(
    @CurrentUser() user: JwtUser,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('studentId') studentId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.store.listSales(user.tid, { q, status, studentId, from, to });
  }

  @Get('sales/:id')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  sale(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.store.getSale(user.tid, id);
  }

  @Post('sales')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  complete(
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
    @Body() dto: CompleteStationerySaleDto,
  ) {
    return this.store.completeSale(user.tid, dto, actor(user, req));
  }

  @Post('sales/:id/cancel')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  cancel(
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: CancelStationerySaleDto,
  ) {
    return this.store.cancelSale(user.tid, id, dto.reason, actor(user, req));
  }

  @Post('purchases')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  purchase(
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
    @Body() dto: CreateStationeryPurchaseDto,
  ) {
    return this.store.createPurchase(user.tid, dto, actor(user, req));
  }

  @Get('purchases')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  purchases(@CurrentUser() user: JwtUser) {
    return this.store.listPurchases(user.tid);
  }

  @Post('stock/adjust')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  adjust(
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
    @Body() dto: AdjustStationeryStockDto,
  ) {
    return this.store.adjustStock(user.tid, dto, actor(user, req));
  }

  @Get('stock/movements')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  movements(
    @CurrentUser() user: JwtUser,
    @Query('productId') productId?: string,
  ) {
    return this.store.stockMovements(user.tid, productId);
  }

  @Post('returns')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  returns(
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
    @Body() dto: CreateStationeryReturnDto,
  ) {
    return this.store.createReturn(user.tid, dto, actor(user, req));
  }

  @Get('reports')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  reports(
    @CurrentUser() user: JwtUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('paymentMethod') paymentMethod?: string,
  ) {
    return this.store.reports(user.tid, { from, to, paymentMethod });
  }
}
