FROM python:3.11-slim

WORKDIR /

COPY requirements.txt /requirements.txt
RUN pip install --no-cache-dir -r /requirements.txt

COPY app/ /app/
COPY integration/ /integration/
COPY run.sh /run.sh
RUN chmod +x /run.sh

CMD ["/run.sh"]
