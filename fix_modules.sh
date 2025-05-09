#!/bin/bash

# List of modules with declaration errors
MODULES=(
  "src/app/pages/login/login.module.ts"
  "src/app/pages/notifications/notifications.module.ts"
  "src/app/pages/order-detail/order-detail.module.ts"
  "src/app/pages/orders/orders.module.ts"
  "src/app/pages/phone-register/phone-register.module.ts"
  "src/app/pages/product-detail/product-detail.module.ts"
  "src/app/pages/register/register.module.ts"
  "src/app/pages/search-results/search-results.module.ts"
)

# Process each module file
for module_file in "${MODULES[@]}"; do
  echo "Processing $module_file"
  
  # Get the component name from the file path
  component_name=$(basename $(dirname "$module_file"))
  component_name=$(echo "$component_name" | sed 's/-//g')
  component_name="${component_name^}Page"
  echo "Component name: $component_name"
  
  # Replace declarations with imports
  sed -i "/declarations: \[$component_name\]/s/declarations: \[$component_name\]/\/\/ declarations: \[$component_name\]/g" "$module_file"
  
  # Add component to imports if not already there
  if ! grep -q "$component_name // Import" "$module_file"; then
    sed -i "/imports: \[/,/\]/s/\(.*\)]/\1  $component_name \/\/ Import instead of declare for standalone components\n]/g" "$module_file"
  fi
  
  echo "Updated $module_file"
done

echo "All module files updated"
