###############################################################################
# VPC, subnets (public + private), IGW, NAT, route tables, security groups.
###############################################################################

resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags                 = merge(var.tags, { Name = "${var.name_prefix}-vpc" })
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = merge(var.tags, { Name = "${var.name_prefix}-igw" })
}

resource "aws_subnet" "public" {
  for_each                = { for idx, cidr in var.public_subnets : idx => cidr }
  vpc_id                  = aws_vpc.this.id
  cidr_block              = each.value
  availability_zone       = var.availability_zones[tonumber(each.key)]
  map_public_ip_on_launch = true
  tags = merge(var.tags, {
    Name = "${var.name_prefix}-public-${var.availability_zones[tonumber(each.key)]}"
    Tier = "public"
  })
}

resource "aws_subnet" "private" {
  for_each          = { for idx, cidr in var.private_subnets : idx => cidr }
  vpc_id            = aws_vpc.this.id
  cidr_block        = each.value
  availability_zone = var.availability_zones[tonumber(each.key)]
  tags = merge(var.tags, {
    Name = "${var.name_prefix}-private-${var.availability_zones[tonumber(each.key)]}"
    Tier = "private"
  })
}

# NAT: single NAT for dev/staging, one per AZ for prod
resource "aws_eip" "nat" {
  for_each = var.single_nat_gateway ? { "0" = 0 } : { for idx, _ in var.public_subnets : tostring(idx) => idx }
  domain   = "vpc"
  tags     = merge(var.tags, { Name = "${var.name_prefix}-nat-eip-${each.key}" })
}

resource "aws_nat_gateway" "this" {
  for_each      = var.single_nat_gateway ? { "0" = 0 } : { for idx, _ in var.public_subnets : tostring(idx) => idx }
  allocation_id = aws_eip.nat[each.key].id
  subnet_id     = aws_subnet.public[each.key].id
  tags          = merge(var.tags, { Name = "${var.name_prefix}-nat-${each.key}" })
  depends_on    = [aws_internet_gateway.this]
}

# Public route table
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }
  tags = merge(var.tags, { Name = "${var.name_prefix}-rt-public" })
}

resource "aws_route_table_association" "public" {
  for_each       = aws_subnet.public
  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}

# Private route tables (one per AZ for HA in prod; single in dev)
resource "aws_route_table" "private" {
  for_each = aws_subnet.private
  vpc_id   = aws_vpc.this.id
  tags     = merge(var.tags, { Name = "${var.name_prefix}-rt-private-${each.key}" })
}

resource "aws_route" "private_nat" {
  for_each               = aws_route_table.private
  route_table_id         = each.value.id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = var.single_nat_gateway ? aws_nat_gateway.this["0"].id : aws_nat_gateway.this[each.key].id
}

resource "aws_route_table_association" "private" {
  for_each       = aws_subnet.private
  subnet_id      = each.value.id
  route_table_id = aws_route_table.private[each.key].id
}

###############################################################################
# Security groups
###############################################################################

resource "aws_security_group" "alb" {
  name        = "${var.name_prefix}-alb-sg"
  description = "ALB ingress from the internet"
  vpc_id      = aws_vpc.this.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "All egress"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-alb-sg" })
}

resource "aws_security_group" "ecs_backend" {
  name        = "${var.name_prefix}-ecs-backend-sg"
  description = "Backend Fargate tasks — ingress from ALB only"
  vpc_id      = aws_vpc.this.id

  ingress {
    description     = "Backend 8083 from ALB"
    from_port       = 8083
    to_port         = 8083
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    description = "All egress"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-ecs-backend-sg" })
}

resource "aws_security_group" "ecs_frontend" {
  name        = "${var.name_prefix}-ecs-frontend-sg"
  description = "Frontend Fargate tasks — ingress from ALB only"
  vpc_id      = aws_vpc.this.id

  ingress {
    description     = "Frontend 80 from ALB"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    description = "All egress"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-ecs-frontend-sg" })
}
