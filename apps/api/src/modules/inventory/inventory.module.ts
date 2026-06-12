import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
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

@Module({
  controllers: [InventoryController],
  providers: [
    InventoryDashboardService,
    InventoryStoresService,
    InventoryItemsService,
    InventoryTransactionsService,
    InventoryVendorsService,
    InventoryPurchaseOrdersService,
    InventoryLabelsService,
    InventoryVendorPricesService,
    InventoryRequisitionsService,
    InventorySuggestionsService,
  ],
})
export class InventoryModule {}
