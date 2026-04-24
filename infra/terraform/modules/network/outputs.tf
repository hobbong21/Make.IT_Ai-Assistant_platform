output "vpc_id" {
  value = aws_vpc.this.id
}

output "vpc_cidr" {
  value = aws_vpc.this.cidr_block
}

output "public_subnet_ids" {
  value = [for s in aws_subnet.public : s.id]
}

output "private_subnet_ids" {
  value = [for s in aws_subnet.private : s.id]
}

output "alb_security_group_id" {
  value = aws_security_group.alb.id
}

output "ecs_backend_security_group_id" {
  value = aws_security_group.ecs_backend.id
}

output "ecs_frontend_security_group_id" {
  value = aws_security_group.ecs_frontend.id
}
