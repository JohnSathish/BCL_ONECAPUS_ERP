'use client';

import { EnterpriseCrudWorkspace } from '@/components/enterprise/enterprise-crud-workspace';
import { SupportCentreWorkspace } from '@/components/support-centre/support-centre-workspace';

export function HelpdeskWorkspace() {
  return <SupportCentreWorkspace />;
}

export function ParentPortalAdminWorkspace() {
  return (
    <EnterpriseCrudWorkspace
      title="Parent Portal"
      description="Link parent portal users to student wards."
      queryKey={['enterprise', 'parent-portal']}
      listPath="/v1/parent-portal/links"
      fields={[
        { name: 'parentUserId', label: 'Parent user ID', required: true },
        { name: 'studentId', label: 'Student ID', required: true },
        { name: 'relationship', label: 'Relationship', placeholder: 'GUARDIAN' },
      ]}
      columns={[
        { key: 'parentUserId', label: 'Parent' },
        { key: 'studentId', label: 'Student' },
        { key: 'relationship', label: 'Relationship' },
        { key: 'status', label: 'Status' },
      ]}
    />
  );
}

export function VisitorManagementWorkspace() {
  return (
    <EnterpriseCrudWorkspace
      title="Visitor Management"
      description="Campus visitor check-in and passes."
      queryKey={['enterprise', 'visitor-management']}
      listPath="/v1/visitor-management/visits"
      fields={[
        { name: 'visitorName', label: 'Visitor name', required: true },
        { name: 'phone', label: 'Phone' },
        { name: 'hostName', label: 'Host' },
        { name: 'purpose', label: 'Purpose' },
      ]}
      columns={[
        { key: 'visitorName', label: 'Visitor' },
        { key: 'hostName', label: 'Host' },
        { key: 'purpose', label: 'Purpose' },
        { key: 'status', label: 'Status' },
      ]}
    />
  );
}

export function PlacementWorkspace() {
  return (
    <EnterpriseCrudWorkspace
      title="Placement"
      description="Recruiters and campus placement drives."
      queryKey={['enterprise', 'placement']}
      listPath="/v1/placement/recruiters"
      fields={[
        { name: 'name', label: 'Recruiter name', required: true },
        { name: 'contactEmail', label: 'Email', type: 'email' },
        { name: 'contactPhone', label: 'Phone' },
        { name: 'industry', label: 'Industry' },
      ]}
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'industry', label: 'Industry' },
        { key: 'contactEmail', label: 'Email' },
        { key: 'status', label: 'Status' },
      ]}
    />
  );
}

export function InternshipWorkspace() {
  return (
    <EnterpriseCrudWorkspace
      title="Internship"
      description="Internship companies and placements."
      queryKey={['enterprise', 'internship']}
      listPath="/v1/internship/companies"
      fields={[
        { name: 'name', label: 'Company name', required: true },
        { name: 'contactEmail', label: 'Email', type: 'email' },
        { name: 'contactPhone', label: 'Phone' },
        { name: 'address', label: 'Address' },
      ]}
      columns={[
        { key: 'name', label: 'Company' },
        { key: 'contactEmail', label: 'Email' },
        { key: 'contactPhone', label: 'Phone' },
        { key: 'status', label: 'Status' },
      ]}
    />
  );
}

export function AlumniWorkspace() {
  return (
    <EnterpriseCrudWorkspace
      title="Alumni"
      description="Alumni directory and mentorship opt-in."
      queryKey={['enterprise', 'alumni']}
      listPath="/v1/alumni/profiles"
      fields={[
        { name: 'fullName', label: 'Full name', required: true },
        { name: 'graduationYear', label: 'Graduation year', type: 'number' },
        { name: 'programme', label: 'Programme' },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'currentOrg', label: 'Current organisation' },
      ]}
      columns={[
        { key: 'fullName', label: 'Name' },
        { key: 'graduationYear', label: 'Year' },
        { key: 'programme', label: 'Programme' },
        { key: 'currentOrg', label: 'Organisation' },
      ]}
    />
  );
}

export function HostelWorkspace() {
  return (
    <EnterpriseCrudWorkspace
      title="Hostel"
      description="Hostel blocks and capacity."
      queryKey={['enterprise', 'hostel']}
      listPath="/v1/hostel/blocks"
      fields={[
        { name: 'code', label: 'Block code', required: true },
        { name: 'name', label: 'Block name', required: true },
        { name: 'gender', label: 'Gender', placeholder: 'MALE / FEMALE / MIXED' },
        { name: 'capacity', label: 'Capacity', type: 'number' },
      ]}
      columns={[
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Name' },
        { key: 'gender', label: 'Gender' },
        { key: 'capacity', label: 'Capacity' },
        { key: 'status', label: 'Status' },
      ]}
    />
  );
}

export function ResearchWorkspace() {
  return (
    <EnterpriseCrudWorkspace
      title="Research Grants"
      description="Light research grant registry."
      queryKey={['enterprise', 'research']}
      listPath="/v1/research/grants"
      fields={[
        { name: 'title', label: 'Title', required: true },
        { name: 'fundingAgency', label: 'Funding agency' },
        { name: 'amount', label: 'Amount', type: 'number' },
        { name: 'startDate', label: 'Start date', type: 'date' },
      ]}
      columns={[
        { key: 'title', label: 'Title' },
        { key: 'fundingAgency', label: 'Agency' },
        { key: 'amount', label: 'Amount' },
        { key: 'status', label: 'Status' },
      ]}
    />
  );
}

export function WorkflowWorkspace() {
  return (
    <EnterpriseCrudWorkspace
      title="Workflow Engine"
      description="Reusable approval workflow definitions."
      queryKey={['enterprise', 'workflow']}
      listPath="/v1/workflow/definitions"
      fields={[
        { name: 'code', label: 'Code', required: true },
        { name: 'name', label: 'Name', required: true },
        { name: 'entityType', label: 'Entity type', required: true, placeholder: 'SUPPORT_TICKET' },
        { name: 'description', label: 'Description' },
      ]}
      columns={[
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Name' },
        { key: 'entityType', label: 'Entity' },
        { key: 'isActive', label: 'Active' },
      ]}
    />
  );
}

export function IntegrationsWorkspace() {
  return (
    <EnterpriseCrudWorkspace
      title="Integrations"
      description="External connector registry."
      queryKey={['enterprise', 'integrations']}
      listPath="/v1/integrations/connectors"
      fields={[
        { name: 'provider', label: 'Provider', required: true, placeholder: 'razorpay' },
        { name: 'displayName', label: 'Display name', required: true },
        { name: 'status', label: 'Status', placeholder: 'ACTIVE' },
      ]}
      columns={[
        { key: 'provider', label: 'Provider' },
        { key: 'displayName', label: 'Name' },
        { key: 'status', label: 'Status' },
      ]}
    />
  );
}

export function AssetServicesWorkspace() {
  return (
    <EnterpriseCrudWorkspace
      title="Asset Services / AMC"
      description="Inventory asset lifecycle, warranty, and AMC history."
      queryKey={['enterprise', 'inventory', 'asset-services']}
      listPath="/v1/inventory/asset-services"
      fields={[
        { name: 'assetTag', label: 'Asset tag' },
        { name: 'serviceType', label: 'Service type', placeholder: 'AMC', required: true },
        { name: 'vendorName', label: 'Vendor' },
        { name: 'serviceDate', label: 'Service date', type: 'date' },
        { name: 'amcUntil', label: 'AMC until', type: 'date' },
        { name: 'cost', label: 'Cost', type: 'number' },
      ]}
      columns={[
        { key: 'assetTag', label: 'Asset' },
        { key: 'serviceType', label: 'Type' },
        { key: 'vendorName', label: 'Vendor' },
        { key: 'amcUntil', label: 'AMC until' },
        { key: 'cost', label: 'Cost' },
      ]}
    />
  );
}
