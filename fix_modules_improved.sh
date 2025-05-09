#!/bin/bash

# List of modules with declaration errors
declare -A module_component_map=(
  ["src/app/pages/notifications/notifications.module.ts"]="NotificationsPage"
  ["src/app/pages/order-detail/order-detail.module.ts"]="OrderDetailPage"
  ["src/app/pages/orders/orders.module.ts"]="OrdersPage"
  ["src/app/pages/phone-register/phone-register.module.ts"]="PhoneRegisterPage"
  ["src/app/pages/product-detail/product-detail.module.ts"]="ProductDetailPage"
  ["src/app/pages/register/register.module.ts"]="RegisterPage"
  ["src/app/pages/search-results/search-results.module.ts"]="SearchResultsPage"
)

# Process each module file
for module_file in "${!module_component_map[@]}"; do
  component_name=${module_component_map[$module_file]}
  echo "Processing $module_file with component $component_name"
  
  # Fix the module by handling both the import and the declaration properly
  # 1. Add a comma after the last import item
  # 2. Add the component to the imports list
  # 3. Comment out the declaration
  
  # Add component to imports properly with a comma
  sed -i -E "s/(RouterModule\.forChild\(routes\))/\1,\n    $component_name \/\/ Import instead of declare for standalone components/g" "$module_file"
  
  # Comment out declarations
  sed -i -E "s/declarations: \[[^]]+\]/\/\/ declarations: \[$component_name\]/g" "$module_file"
  
  echo "Updated $module_file"
done

echo "All module files updated"
