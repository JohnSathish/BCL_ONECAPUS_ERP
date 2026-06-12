import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import {
  ApproveRequisitionDto,
  ConvertRequisitionDto,
  CreateItemDto,
  CreatePoFromSuggestionDto,
  CreatePurchaseOrderDto,
  CreateRequisitionDto,
  CreateStoreDto,
  CreateVendorDto,
  LabelBatchDto,
  ListQueryDto,
  ReceivePoLineDto,
  StockMovementDto,
  UpdateItemDto,
  UpdateVendorDto,
  UpsertVendorPriceDto,
} from './dto/inventory.dto';
import { InventoryLabelsService } from './services/inventory-labels.service';
import { InventoryPurchaseOrdersService } from './services/inventory-purchase-orders.service';
import { InventoryRequisitionsService } from './services/inventory-requisitions.service';
import { InventorySuggestionsService } from './services/inventory-suggestions.service';
import {
  InventoryDashboardService,
  InventoryItemsService,
  InventoryStoresService,
  InventoryTransactionsService,
} from './services/inventory.service';
import { InventoryVendorPricesService } from './services/inventory-vendor-prices.service';
import { InventoryVendorsService } from './services/inventory-vendors.service';

const INV_READ = [
  'inventory:read',
  'inventory:manage',
  'inventory:issue',
] as const;
const INV_MANAGE = ['inventory:manage'] as const;
const INV_ISSUE = ['inventory:issue', 'inventory:manage'] as const;

@ApiBearerAuth()
@ApiTags('inventory')
@Controller({ path: 'inventory', version: '1' })
export class InventoryController {
  constructor(
    private readonly dashboard: InventoryDashboardService,
    private readonly stores: InventoryStoresService,
    private readonly items: InventoryItemsService,
    private readonly transactions: InventoryTransactionsService,
    private readonly vendors: InventoryVendorsService,
    private readonly purchaseOrders: InventoryPurchaseOrdersService,
    private readonly labels: InventoryLabelsService,
    private readonly vendorPrices: InventoryVendorPricesService,
    private readonly requisitions: InventoryRequisitionsService,
    private readonly suggestions: InventorySuggestionsService,
  ) {}

  @Get('dashboard')
  @RequireAnyPermission(...INV_READ)
  getDashboard(@CurrentUser() user: JwtUser) {
    return this.dashboard.dashboard(user.tid);
  }

  @Get('stores')
  @RequireAnyPermission(...INV_READ)
  listStores(@CurrentUser() user: JwtUser, @Query() query: ListQueryDto) {
    return this.stores.list(user.tid, query);
  }

  @Post('stores')
  @RequireAnyPermission(...INV_MANAGE)
  createStore(@CurrentUser() user: JwtUser, @Body() dto: CreateStoreDto) {
    return this.stores.create(user, dto);
  }

  @Get('items')
  @RequireAnyPermission(...INV_READ)
  listItems(@CurrentUser() user: JwtUser, @Query() query: ListQueryDto) {
    return this.items.list(user.tid, query);
  }

  @Get('items/lookup/:barcode')
  @RequireAnyPermission(...INV_READ)
  lookupItem(@CurrentUser() user: JwtUser, @Param('barcode') barcode: string) {
    return this.labels.lookupByBarcode(user.tid, decodeURIComponent(barcode));
  }

  @Post('items')
  @RequireAnyPermission(...INV_MANAGE)
  createItem(@CurrentUser() user: JwtUser, @Body() dto: CreateItemDto) {
    return this.items.create(user, dto);
  }

  @Patch('items/:id')
  @RequireAnyPermission(...INV_MANAGE)
  updateItem(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.items.update(user, id, dto);
  }

  @Post('labels/batch')
  @RequireAnyPermission(...INV_READ)
  batchLabels(@CurrentUser() user: JwtUser, @Body() dto: LabelBatchDto) {
    return this.labels.batchLabels(user.tid, dto);
  }

  @Get('transactions')
  @RequireAnyPermission(...INV_READ)
  listTransactions(@CurrentUser() user: JwtUser, @Query() query: ListQueryDto) {
    return this.transactions.list(user.tid, query);
  }

  @Post('transactions/receipt')
  @RequireAnyPermission(...INV_MANAGE, ...INV_ISSUE)
  receipt(@CurrentUser() user: JwtUser, @Body() dto: StockMovementDto) {
    return this.transactions.receipt(user, dto);
  }

  @Post('transactions/issue')
  @RequireAnyPermission(...INV_ISSUE)
  issue(@CurrentUser() user: JwtUser, @Body() dto: StockMovementDto) {
    return this.transactions.issue(user, dto);
  }

  @Post('transactions/return')
  @RequireAnyPermission(...INV_ISSUE)
  returnStock(@CurrentUser() user: JwtUser, @Body() dto: StockMovementDto) {
    return this.transactions.returnStock(user, dto);
  }

  @Get('vendors')
  @RequireAnyPermission(...INV_READ)
  listVendors(@CurrentUser() user: JwtUser, @Query() query: ListQueryDto) {
    return this.vendors.list(user.tid, query);
  }

  @Post('vendors')
  @RequireAnyPermission(...INV_MANAGE)
  createVendor(@CurrentUser() user: JwtUser, @Body() dto: CreateVendorDto) {
    return this.vendors.create(user, dto);
  }

  @Patch('vendors/:id')
  @RequireAnyPermission(...INV_MANAGE)
  updateVendor(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateVendorDto,
  ) {
    return this.vendors.update(user, id, dto);
  }

  @Get('purchase-orders')
  @RequireAnyPermission(...INV_READ)
  listPurchaseOrders(
    @CurrentUser() user: JwtUser,
    @Query() query: ListQueryDto,
  ) {
    return this.purchaseOrders.list(user.tid, query);
  }

  @Get('purchase-orders/:id')
  @RequireAnyPermission(...INV_READ)
  getPurchaseOrder(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.purchaseOrders.get(user.tid, id);
  }

  @Post('purchase-orders')
  @RequireAnyPermission(...INV_MANAGE)
  createPurchaseOrder(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreatePurchaseOrderDto,
  ) {
    return this.purchaseOrders.create(user, dto);
  }

  @Post('purchase-orders/:id/submit')
  @RequireAnyPermission(...INV_MANAGE)
  submitPurchaseOrder(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.purchaseOrders.submit(user, id);
  }

  @Post('purchase-orders/:id/cancel')
  @RequireAnyPermission(...INV_MANAGE)
  cancelPurchaseOrder(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.purchaseOrders.cancel(user, id);
  }

  @Post('purchase-orders/:id/receive')
  @RequireAnyPermission(...INV_MANAGE)
  receivePurchaseOrderLine(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ReceivePoLineDto,
  ) {
    return this.purchaseOrders.receiveLine(user, id, dto);
  }

  @Get('vendors/:vendorId/prices')
  @RequireAnyPermission(...INV_READ)
  listVendorPrices(
    @CurrentUser() user: JwtUser,
    @Param('vendorId') vendorId: string,
  ) {
    return this.vendorPrices.listForVendor(user.tid, vendorId);
  }

  @Post('vendors/:vendorId/prices')
  @RequireAnyPermission(...INV_MANAGE)
  upsertVendorPrice(
    @CurrentUser() user: JwtUser,
    @Param('vendorId') vendorId: string,
    @Body() dto: UpsertVendorPriceDto,
  ) {
    return this.vendorPrices.upsert(user, vendorId, dto);
  }

  @Get('items/:itemId/vendor-prices')
  @RequireAnyPermission(...INV_READ)
  listItemVendorPrices(
    @CurrentUser() user: JwtUser,
    @Param('itemId') itemId: string,
  ) {
    return this.vendorPrices.listForItem(user.tid, itemId);
  }

  @Get('requisitions')
  @RequireAnyPermission(...INV_READ)
  listRequisitions(@CurrentUser() user: JwtUser, @Query() query: ListQueryDto) {
    return this.requisitions.list(user.tid, query);
  }

  @Get('requisitions/:id')
  @RequireAnyPermission(...INV_READ)
  getRequisition(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.requisitions.get(user.tid, id);
  }

  @Post('requisitions')
  @RequireAnyPermission(...INV_ISSUE)
  createRequisition(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateRequisitionDto,
  ) {
    return this.requisitions.create(user, dto);
  }

  @Post('requisitions/:id/submit')
  @RequireAnyPermission(...INV_ISSUE)
  submitRequisition(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.requisitions.submit(user, id);
  }

  @Post('requisitions/:id/approve')
  @RequireAnyPermission(...INV_MANAGE)
  approveRequisition(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ApproveRequisitionDto,
  ) {
    return this.requisitions.approve(user, id, dto);
  }

  @Post('requisitions/:id/reject')
  @RequireAnyPermission(...INV_MANAGE)
  rejectRequisition(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.requisitions.reject(user, id);
  }

  @Post('requisitions/:id/convert-to-po')
  @RequireAnyPermission(...INV_MANAGE)
  convertRequisitionToPo(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ConvertRequisitionDto,
  ) {
    return this.requisitions.convertToPo(user, id, dto);
  }

  @Get('suggestions/restock')
  @RequireAnyPermission(...INV_READ)
  restockSuggestions(@CurrentUser() user: JwtUser) {
    return this.suggestions.restockSuggestions(user.tid);
  }

  @Post('suggestions/create-po')
  @RequireAnyPermission(...INV_MANAGE)
  createPoFromSuggestions(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreatePoFromSuggestionDto,
  ) {
    return this.suggestions.createPoFromSuggestions(user, dto);
  }
}
