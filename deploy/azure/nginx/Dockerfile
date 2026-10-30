FROM nginx:1.28-alpine
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 8443
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8081/healthz || exit 1
CMD ["nginx", "-g", "daemon off;"]
