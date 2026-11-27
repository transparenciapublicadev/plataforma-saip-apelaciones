FROM nginx:1.28-alpine
COPY nginx.conf /etc/nginx/yaiku.conf.template
COPY start-proxy.sh /usr/local/bin/start-proxy
RUN chmod +x /usr/local/bin/start-proxy \
    && ln -sf /tmp/yaiku-nginx.conf /etc/nginx/nginx.conf
EXPOSE 8443
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8081/healthz || exit 1
ENTRYPOINT ["/usr/local/bin/start-proxy"]
CMD ["nginx", "-g", "daemon off;"]
