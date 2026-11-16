import { getCustomerAddresses, getDeliveryZones, type CustomerAddress, type DeliveryZone } from "@/lib/customer-orders";

export type AddressForm = {
  title: string;
  recipientName: string;
  contactPhone: string;
  deliveryAddress: string;
  deliveryZoneId: string;
  mapsUrl: string;
  isDefault: boolean;
};

export type AddressSnapshot = {
  addresses: CustomerAddress[];
  zones: DeliveryZone[];
  validatedAt: number;
};

export const emptyAddressForm: AddressForm = {
  title: "",
  recipientName: "",
  contactPhone: "",
  deliveryAddress: "",
  deliveryZoneId: "",
  mapsUrl: "",
  isDefault: false,
};

const snapshots = new Map<string, AddressSnapshot>();
const reads = new Map<string, Promise<AddressSnapshot>>();
const scrollOffsets = new Map<string, number>();
const drafts = new Map<string, { form: AddressForm; baseline: AddressForm }>();
const notices = new Map<string, string>();

export const ADDRESS_REVALIDATE_AFTER_MS = 60_000;

export function peekAddressDirectory(scope: string) {
  return snapshots.get(scope);
}

export function readAddressDirectory(scope: string, force = false) {
  const current = reads.get(scope);
  if (current && !force) return current;
  const request = Promise.all([getCustomerAddresses(), getDeliveryZones()])
    .then(([addresses, zones]) => {
      const snapshot = { addresses, zones, validatedAt: Date.now() };
      snapshots.set(scope, snapshot);
      return snapshot;
    })
    .finally(() => {
      if (reads.get(scope) === request) reads.delete(scope);
    });
  reads.set(scope, request);
  return request;
}

export function getAddressScroll(scope: string) {
  return scrollOffsets.get(scope) ?? 0;
}

export function setAddressScroll(scope: string, offset: number) {
  scrollOffsets.set(scope, offset);
}

function draftKey(scope: string, addressId: string | null) {
  return `${scope}:${addressId ?? "new"}`;
}

export function getAddressDraft(scope: string, addressId: string | null) {
  return drafts.get(draftKey(scope, addressId));
}

export function setAddressDraft(scope: string, addressId: string | null, form: AddressForm, baseline: AddressForm) {
  drafts.set(draftKey(scope, addressId), { form, baseline });
}

export function clearAddressDraft(scope: string, addressId: string | null) {
  drafts.delete(draftKey(scope, addressId));
}

export function setAddressNotice(scope: string, message: string) {
  notices.set(scope, message);
}

export function takeAddressNotice(scope: string) {
  const message = notices.get(scope);
  notices.delete(scope);
  return message;
}

export function addressToForm(address: CustomerAddress): AddressForm {
  return {
    title: address.title,
    recipientName: address.recipient_name,
    contactPhone: address.contact_phone,
    deliveryAddress: address.delivery_address,
    deliveryZoneId: address.zone?.is_active ? address.delivery_zone_id : "",
    mapsUrl: address.maps_url,
    isDefault: address.is_default,
  };
}
