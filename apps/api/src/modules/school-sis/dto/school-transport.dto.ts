import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class SaveTransportSettingsDto {
  @IsOptional() @IsString() transportName?: string;
  @IsOptional() @IsString() managerName?: string;
  @IsOptional() @IsString() emergencyContact?: string;
  @IsOptional() @IsBoolean() gpsEnabled?: boolean;
  @IsOptional() @IsString() gpsProvider?: string;
  @IsOptional() @IsString() mapProvider?: string;
  @IsOptional() @IsInt() gpsOfflineMinutes?: number;
  @IsOptional() @IsInt() overspeedKmh?: number;
  @IsOptional() @IsInt() geofenceDefaultMeters?: number;
  @IsOptional() @IsBoolean() allowCapacityOverride?: boolean;
  @IsOptional() @IsBoolean() requireCapacityApproval?: boolean;
  @IsOptional() @IsBoolean() requireValidDocuments?: boolean;
  @IsOptional() @IsBoolean() blockExpiredDriver?: boolean;
  @IsOptional() @IsBoolean() allowDriverOverride?: boolean;
  @IsOptional() @IsBoolean() notifyParents?: boolean;
  @IsOptional() @IsBoolean() notifySms?: boolean;
  @IsOptional() @IsBoolean() notifyWhatsapp?: boolean;
  @IsOptional() @IsBoolean() notifyEmail?: boolean;
  @IsOptional() @IsBoolean() notifyPush?: boolean;
  @IsOptional() @IsBoolean() preTripChecklistRequired?: boolean;
  @IsOptional() @IsBoolean() postTripChecklistRequired?: boolean;
  @IsOptional() @IsBoolean() blockDispatchOnFail?: boolean;
  @IsOptional() @IsObject() policyJson?: Record<string, unknown>;
}

export class SaveVehicleDto {
  @IsOptional() @IsString() @MaxLength(40) code?: string;
  @IsString() @MaxLength(40) registrationNumber!: string;
  @IsOptional() @IsString() vehicleType?: string;
  @IsOptional() @IsString() make?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsInt() year?: number;
  @IsOptional() @IsString() colour?: string;
  @IsOptional() @IsInt() @Min(0) seatingCapacity?: number;
  @IsOptional() @IsInt() @Min(0) standingCapacity?: number;
  @IsOptional() @IsString() ownership?: string;
  @IsOptional() @IsString() fuelType?: string;
  @IsOptional() @IsInt() odometer?: number;
  @IsOptional() @IsString() gpsDeviceId?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() fleetRole?: string;
  @IsOptional() @IsString() remarks?: string;
  @IsOptional() @IsObject() detailsJson?: Record<string, unknown>;
}

export class SaveVehicleDocumentDto {
  @IsString() kind!: string;
  @IsOptional() @IsString() documentNumber?: string;
  @IsOptional() @IsDateString() issueDate?: string;
  @IsOptional() @IsDateString() expiryDate?: string;
  @IsOptional() @IsString() attachmentUrl?: string;
  @IsOptional() @IsString() remarks?: string;
}

export class SavePersonnelDto {
  @IsString() kind!: string;
  @IsOptional() @IsString() employment?: string;
  @IsOptional() @IsUUID() staffId?: string;
  @IsOptional() @IsString() code?: string;
  @IsString() @MaxLength(160) fullName!: string;
  @IsOptional() @IsString() photoUrl?: string;
  @IsOptional() @IsString() mobile?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() emergencyContact?: string;
  @IsOptional() @IsString() licenseNumber?: string;
  @IsOptional() @IsString() licenseType?: string;
  @IsOptional() @IsDateString() licenseIssueDate?: string;
  @IsOptional() @IsDateString() licenseExpiry?: string;
  @IsOptional() @IsInt() experienceYears?: number;
  @IsOptional() @IsString() status?: string;
}

export class SavePersonnelDocumentDto {
  @IsString() kind!: string;
  @IsOptional() @IsString() documentNumber?: string;
  @IsOptional() @IsDateString() issueDate?: string;
  @IsOptional() @IsDateString() expiryDate?: string;
  @IsOptional() @IsString() attachmentUrl?: string;
  @IsOptional() @IsString() remarks?: string;
}

export class SaveStopDto {
  @IsOptional() @IsString() code?: string;
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsString() area?: string;
  @IsOptional() @IsString() landmark?: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsOptional() @IsInt() geofenceMeters?: number;
  @IsOptional() @IsString() morningPickup?: string;
  @IsOptional() @IsString() afternoonDrop?: string;
  @IsOptional() @IsInt() maxStudents?: number;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsObject() safetyJson?: Record<string, unknown>;
}

export class RouteStopRowDto {
  @IsUUID() stopId!: string;
  @IsInt() stopNumber!: number;
  @IsOptional() @IsString() pickupTime?: string;
  @IsOptional() @IsString() dropTime?: string;
}

export class SaveRouteDto {
  @IsOptional() @IsString() code?: string;
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsString() direction?: string;
  @IsOptional() @IsString() routeType?: string;
  @IsOptional() @IsString() startPoint?: string;
  @IsOptional() @IsString() endPoint?: string;
  @IsOptional() @IsInt() maxCapacity?: number;
  @IsOptional() @IsString() morningStartTime?: string;
  @IsOptional() @IsString() schoolArrivalTime?: string;
  @IsOptional() @IsString() afternoonDepartureTime?: string;
  @IsOptional() @IsNumber() distanceKm?: number;
  @IsOptional() @IsInt() estimatedMinutes?: number;
  @IsOptional() @IsUUID() vehicleId?: string;
  @IsOptional() @IsUUID() driverId?: string;
  @IsOptional() @IsUUID() attendantId?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsBoolean() overrideDriver?: boolean;
  @IsOptional() @IsBoolean() overrideDocuments?: boolean;
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => RouteStopRowDto)
  stops?: RouteStopRowDto[];
}

export class SaveAllocationDto {
  @IsUUID() studentId!: string;
  @IsUUID() routeId!: string;
  @IsUUID() pickupStopId!: string;
  @IsUUID() dropStopId!: string;
  @IsOptional() @IsUUID() vehicleId?: string;
  @IsOptional() @IsUUID() academicYearId?: string;
  @IsOptional() @IsString() tripMode?: string;
  @IsOptional() @IsDateString() validFrom?: string;
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @IsUUID() feePlanId?: string;
  @IsOptional() @IsString() concessionKind?: string;
  @IsOptional() @IsBoolean() capacityOverride?: boolean;
  @IsOptional() @IsString() overrideReason?: string;
  @IsOptional() @IsBoolean() isTemporary?: boolean;
  @IsOptional() @IsString() temporaryReason?: string;
  @IsOptional() @IsString() remarks?: string;
}

export class BulkAllocationDto {
  @IsArray()
  @IsUUID('4', { each: true })
  studentIds!: string[];
  @IsUUID() routeId!: string;
  @IsUUID() pickupStopId!: string;
  @IsUUID() dropStopId!: string;
  @IsOptional() @IsUUID() vehicleId?: string;
  @IsOptional() @IsString() tripMode?: string;
  @IsOptional() @IsDateString() validFrom?: string;
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @IsBoolean() capacityOverride?: boolean;
  @IsOptional() @IsString() overrideReason?: string;
}

export class GenerateTripsDto {
  @IsDateString() date!: string;
  @IsOptional() @IsUUID() routeId?: string;
  @IsOptional() @IsBoolean() includeSpecialWorking?: boolean;
}

export class TripActionDto {
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsBoolean() safetyOverride?: boolean;
}

export class BoardingDto {
  @IsUUID() studentId!: string;
  @IsString() eventType!: string;
  @IsOptional() @IsUUID() stopId?: string;
  @IsOptional() @IsString() method?: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
}

export class BulkAttendanceDto {
  @IsString() eventType!: string;
  @IsOptional() @IsBoolean() confirm?: boolean;
}

export class SaveMaintenanceDto {
  @IsUUID() vehicleId!: string;
  @IsDateString() date!: string;
  @IsString() serviceType!: string;
  @IsOptional() @IsInt() odometer?: number;
  @IsOptional() @IsString() vendor?: string;
  @IsOptional() @IsString() invoiceNumber?: string;
  @IsOptional() @IsInt() cost?: number;
  @IsOptional() @IsDateString() nextServiceDate?: string;
  @IsOptional() @IsInt() nextServiceOdometer?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() attachmentUrl?: string;
}

export class SaveFuelDto {
  @IsUUID() vehicleId!: string;
  @IsDateString() date!: string;
  @IsInt() odometer!: number;
  @IsNumber() litres!: number;
  @IsOptional() @IsInt() rate?: number;
  @IsOptional() @IsInt() totalAmount?: number;
  @IsOptional() @IsString() fuelType?: string;
  @IsOptional() @IsString() station?: string;
  @IsOptional() @IsString() receiptNo?: string;
  @IsOptional() @IsUUID() driverId?: string;
}

export class SaveIncidentDto {
  @IsString() kind!: string;
  @IsOptional() @IsString() severity?: string;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsUUID() vehicleId?: string;
  @IsOptional() @IsUUID() routeId?: string;
  @IsOptional() @IsUUID() driverId?: string;
  @IsOptional() @IsUUID() tripId?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsString() description!: string;
  @IsOptional() @IsBoolean() sos?: boolean;
  @IsOptional() @IsArray() studentsJson?: unknown[];
  @IsOptional() @IsString() actionTaken?: string;
}

export class BreakdownDto {
  @IsUUID() vehicleId!: string;
  @IsOptional() @IsUUID() replacementVehicleId?: string;
  @IsOptional() @IsUUID() replacementDriverId?: string;
  @IsOptional() @IsUUID() tripId?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() notifyParents?: boolean;
}

export class GpsPingDto {
  @IsUUID() vehicleId!: string;
  @IsOptional() @IsUUID() tripId?: string;
  @IsNumber() latitude!: number;
  @IsNumber() longitude!: number;
  @IsOptional() @IsNumber() speedKmh?: number;
  @IsOptional() @IsNumber() heading?: number;
  @IsOptional() @IsNumber() accuracy?: number;
}

export class SaveGeofenceDto {
  @IsString() kind!: string;
  @IsString() name!: string;
  @IsNumber() latitude!: number;
  @IsNumber() longitude!: number;
  @IsOptional() @IsInt() radiusMeters?: number;
  @IsOptional() @IsUUID() stopId?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class SaveFeePlanDto {
  @IsString() name!: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() cadence?: string;
  @IsOptional() @IsString() pricingModel?: string;
  @IsInt() amount!: number;
  @IsOptional() @IsUUID() academicYearId?: string;
  @IsOptional() @IsUUID() routeId?: string;
  @IsOptional() @IsUUID() stopId?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class SaveConcessionDto {
  @IsString() kind!: string;
  @IsString() name!: string;
  @IsOptional() @IsNumber() percent?: number;
  @IsOptional() @IsInt() amount?: number;
  @IsOptional() @IsUUID() planId?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class SaveRequestDto {
  @IsUUID() studentId!: string;
  @IsString() kind!: string;
  @IsOptional() @IsUUID() routeId?: string;
  @IsOptional() @IsUUID() stopId?: string;
  @IsOptional() @IsDateString() validFrom?: string;
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @IsString() reason?: string;
}

export class ReviewRequestDto {
  @IsString() status!: string;
  @IsOptional() @IsString() remarks?: string;
}

export class ImportRowsDto {
  @IsString() entity!: string;
  @IsArray() rows!: Record<string, unknown>[];
}

export class MobileBoardingDto {
  @IsUUID() tripId!: string;
  @IsUUID() studentId!: string;
  @IsString() eventType!: string;
  @IsOptional() @IsUUID() stopId?: string;
  @IsOptional() @IsString() method?: string;
}

export class MobileSosDto {
  @IsOptional() @IsUUID() tripId?: string;
  @IsOptional() @IsUUID() vehicleId?: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsOptional() @IsString() description?: string;
}
